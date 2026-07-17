import { DownOutlined, LinkOutlined, LoadingOutlined, RightOutlined } from '@ant-design/icons';
import {
  css,
  useAPIClient,
  useCollection,
  useCollectionManager,
  useCollectionRecord,
  useCurrentPopupRecord,
  useDataBlockProps,
  useFormBlockContext,
  useRecord,
} from '@nocobase/client';
import { observer } from '@formily/react';
import { Alert, Button, Empty, Spin, Tag, theme as antdTheme } from 'antd';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const PROCESS_COLLECTION = 'customs_processes';
const HISTORY_COLLECTION = 'process_history';
const MAX_DEPTH = 20;

type ProcessResourceKey = string | number;

type ProcessTreeModelContext = {
  collection?: unknown;
  record?: Record<string, unknown> | null;
  filterByTk?: unknown;
  params?: Record<string, unknown>;
};

type ProcessTreeBlockProps = {
  processId?: ProcessResourceKey | null;
  modelContext?: ProcessTreeModelContext;
};

type ProcessTarget =
  | { status: 'ready'; key: ProcessResourceKey; source: string }
  | { status: 'new' | 'missing' | 'loading'; key?: undefined; source?: string };

type UserRecord = {
  id?: string | number;
  nickname?: string;
  username?: string;
};

type ProcessRecord = {
  id: string | number;
  title?: string;
  status?: string;
  process_number?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: UserRecord;
  updatedBy?: UserRecord;
  inaccessible?: boolean;
};

type EdgeInfo = {
  label: string;
  createdAt?: string;
  createdBy?: UserRecord;
};

type HistoryRow = EdgeInfo & { new_value?: string };

type TreeData = {
  nodes: Map<string, ProcessRecord>;
  parentsByChild: Map<string, string[]>;
  childrenByParent: Map<string, string[]>;
  edgeInfo: Map<string, EdgeInfo>;
  warnings: string[];
};

type LoadDirection = 'up' | 'down' | 'both';

const statusFallbackLabels: Record<string, string> = {
  queue: 'В очереди',
  in_work: 'В работе',
  knr: 'КНР',
  warehouse: 'Склад',
  submission: 'В подаче',
  clearance: 'В оформлении',
  inspection: 'Досмотр',
  expertise: 'Экспертиза',
  release_application: 'Выпуск по заявлению',
  release: 'Выпуск',
  release_guarantee_prepare: 'Выпуск с ДП (подготовка ответа)',
  release_guarantee_badis_answer: 'Выпуск с ДП (ответ в Бадисе)',
  release_guarantee_to_customs: 'Выпуск с ДП (отправка ответа в ТО)',
  release_guarantee_wait_customs: 'Выпуск с ДП (ожидание решения ТО)',
  release_security_ktc: 'Выпуск под обеспечение (КТС)',
  release_security_cost_accepted: 'Выпуск под обеспечение (стоимость принята)',
};

function isEmptyResourceKey(value: unknown): value is null | undefined | '' {
  return value === undefined || value === null || value === '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function callMethod(target: unknown, methodName: string, ...args: unknown[]): unknown {
  const method = asRecord(target)[methodName];
  if (typeof method !== 'function') {
    return undefined;
  }
  try {
    return method.apply(target, args);
  } catch (error) {
    console.debug(`[process-tree] Optional NocoBase method ${methodName} is unavailable`, error);
    return undefined;
  }
}

function getCollectionName(collection: unknown) {
  if (!collection) {
    return undefined;
  }
  if (typeof collection === 'string') {
    return collection;
  }
  const metadata = asRecord(collection);
  return metadata.name || metadata.collectionName || asRecord(metadata.options).name;
}

function isProcessCollection(collection: unknown, record?: Record<string, unknown> | null) {
  return (getCollectionName(collection) || record?.__collectionName) === PROCESS_COLLECTION;
}

function normalizeFilterByTk(value: unknown): ProcessResourceKey | undefined {
  if (isEmptyResourceKey(value)) {
    return undefined;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(asRecord(value)).filter(([, item]) => !isEmptyResourceKey(item));
    if (!entries.length) {
      return undefined;
    }
    const searchParams = new URLSearchParams();
    entries
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([key, item]) => searchParams.append(key, String(item)));
    return searchParams.toString() || undefined;
  }
  return String(value);
}

function getFallbackTargetKey(collection: unknown) {
  const filterTargetKey = callMethod(collection, 'getFilterTargetKey');
  if (filterTargetKey) {
    return filterTargetKey;
  }
  const primaryKey = callMethod(collection, 'getPrimaryKey');
  if (primaryKey) {
    return primaryKey;
  }

  const metadata = asRecord(collection);
  return metadata.filterTargetKey || asRecord(metadata.options).filterTargetKey || metadata.targetKey || 'id';
}

function getKeyFromRecord(
  collectionManager: unknown,
  collection: unknown,
  record: Record<string, unknown> | null | undefined,
) {
  if (!record) {
    return undefined;
  }

  const processKey = callMethod(collectionManager, 'getFilterByTK', PROCESS_COLLECTION, record);
  const normalizedProcessKey = normalizeFilterByTk(processKey);
  if (!isEmptyResourceKey(normalizedProcessKey)) {
    return normalizedProcessKey;
  }

  if (collection) {
    const collectionKey = callMethod(collectionManager, 'getFilterByTK', collection, record);
    const normalizedCollectionKey = normalizeFilterByTk(collectionKey);
    if (!isEmptyResourceKey(normalizedCollectionKey)) {
      return normalizedCollectionKey;
    }
  }

  const targetKey = getFallbackTargetKey(collection);
  if (Array.isArray(targetKey)) {
    return normalizeFilterByTk(
      targetKey.reduce<Record<string, unknown>>((memo, key) => {
        memo[String(key)] = record[String(key)];
        return memo;
      }, {}),
    );
  }

  return normalizeFilterByTk(record[String(targetKey)] ?? record.id);
}

function getCollectionRecordData(record: unknown) {
  if (!record) {
    return undefined;
  }
  const recordData = asRecord(record);
  return recordData.data && typeof recordData.data === 'object' ? asRecord(recordData.data) : recordData;
}

function getProcessCollection(collectionManager: unknown, fallbackCollection?: unknown) {
  return callMethod(collectionManager, 'getCollection', PROCESS_COLLECTION) || fallbackCollection;
}

function isUpdateFormBlock(formBlockContext: unknown, dataBlockProps: unknown) {
  const formBlock = asRecord(formBlockContext);
  const dataBlock = asRecord(dataBlockProps);
  return formBlock.type === 'update' || formBlock.action === 'get' || dataBlock.action === 'get';
}

function isCreateFormBlock(formBlockContext: unknown) {
  return asRecord(formBlockContext).type === 'create';
}

function getRouteFilterByTk() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const paramsList = [window.location.search, window.location.hash.split('?')[1]]
    .filter(Boolean)
    .map((query) => new URLSearchParams(query.replace(/^\?/, '')));

  for (const params of paramsList) {
    const value = params.get('filterByTk') || params.get('filterByTk[]') || params.get('id');
    const normalized = normalizeFilterByTk(value);
    if (!isEmptyResourceKey(normalized)) {
      return normalized;
    }
  }

  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  for (let index = 0; index < pathSegments.length - 1; index += 1) {
    const segment = pathSegments[index].toLowerCase();
    if (segment === 'filterbytk' || segment === 'filter-by-tk' || segment === 'filterbytk[]') {
      const normalized = normalizeFilterByTk(decodeURIComponent(pathSegments[index + 1]));
      if (!isEmptyResourceKey(normalized)) {
        return normalized;
      }
    }
  }

  return undefined;
}

function useProcessTarget(
  modelContext?: ProcessTreeModelContext,
  explicitProcessId?: ProcessResourceKey | null,
): ProcessTarget {
  const collectionManager = useCollectionManager();
  const collection = useCollection();
  const collectionRecord = useCollectionRecord<Record<string, unknown>>();
  const dataBlockProps = useDataBlockProps();
  const formBlockContext = useFormBlockContext();
  const popupRecord = useCurrentPopupRecord();
  const recordContext = useRecord<Record<string, unknown>>();
  const processCollection = getProcessCollection(collectionManager, collection);
  const formBlockCollection = formBlockContext?.collectionName || dataBlockProps?.collection || collection;
  const isProcessFormBlock = isProcessCollection(formBlockCollection);
  const formBlockIsCreate = isProcessFormBlock && isCreateFormBlock(formBlockContext);
  const formBlockIsUpdate = isProcessFormBlock && isUpdateFormBlock(formBlockContext, dataBlockProps);

  if (formBlockIsCreate) {
    return { status: 'new', source: 'form-create' };
  }

  if (formBlockIsUpdate) {
    const formCandidates = [
      { source: 'form-record', record: getCollectionRecordData(formBlockContext?.formRecord) },
      { source: 'form-current-values', record: formBlockContext?.form?.values },
      { source: 'form-initial-values', record: formBlockContext?.form?.initialValues },
      { source: 'form-service-data', record: formBlockContext?.service?.data?.data },
    ];

    for (const candidate of formCandidates) {
      if (!candidate.record) {
        continue;
      }
      const key = getKeyFromRecord(collectionManager, processCollection, candidate.record);
      if (!isEmptyResourceKey(key)) {
        return { status: 'ready', key, source: candidate.source };
      }
    }
  }

  const candidates = [
    { source: 'edit-popup', collection: popupRecord?.collection, record: popupRecord?.value },
    { source: 'record-context', collection: collection || modelContext?.collection, record: recordContext },
    {
      source: 'collection-record',
      collection: collection || dataBlockProps?.collection,
      record: collectionRecord?.data,
      isNew: collectionRecord?.isNew,
    },
    { source: 'model-context', collection: modelContext?.collection, record: modelContext?.record },
  ];

  for (const candidate of candidates) {
    if (!isProcessCollection(candidate.collection, candidate.record)) {
      continue;
    }
    const key = getKeyFromRecord(collectionManager, candidate.collection, candidate.record);
    if (!isEmptyResourceKey(key)) {
      return { status: 'ready', key, source: candidate.source };
    }
  }

  if (!isEmptyResourceKey(explicitProcessId)) {
    return { status: 'ready', key: explicitProcessId, source: 'explicit-prop' };
  }

  const hasProcessContext =
    isProcessFormBlock || candidates.some((candidate) => isProcessCollection(candidate.collection, candidate.record));
  const isNewProcess =
    formBlockIsCreate ||
    candidates.some((candidate) => candidate.isNew && isProcessCollection(candidate.collection, candidate.record));

  if (isNewProcess) {
    return { status: 'new', source: 'form-record' };
  }

  const fallbackKey = normalizeFilterByTk(
    dataBlockProps?.filterByTk ??
      dataBlockProps?.params?.filterByTk ??
      formBlockContext?.params?.filterByTk ??
      modelContext?.filterByTk ??
      modelContext?.params?.filterByTk,
  );
  if (hasProcessContext && !isEmptyResourceKey(fallbackKey)) {
    return { status: 'ready', key: fallbackKey, source: 'filterByTk' };
  }

  const routeKey = getRouteFilterByTk();
  if (!isEmptyResourceKey(routeKey)) {
    return { status: 'ready', key: routeKey, source: 'route' };
  }

  if (formBlockIsUpdate || (dataBlockProps?.action === 'get' && hasProcessContext)) {
    return { status: 'loading', source: 'form-record' };
  }

  return { status: 'missing' };
}

function keyOf(value: unknown) {
  return String(value);
}

function edgeKey(parentId: string, childId: string) {
  return `${parentId}->${childId}`;
}

function uniqueSorted(ids: string[], nodes: Map<string, ProcessRecord>) {
  const unique = Array.from(new Set(ids));
  return unique.sort((left, right) => {
    const leftNode = nodes.get(left);
    const rightNode = nodes.get(right);
    const numberDiff =
      Number(leftNode?.process_number || Number.MAX_SAFE_INTEGER) -
      Number(rightNode?.process_number || Number.MAX_SAFE_INTEGER);
    if (numberDiff !== 0) {
      return numberDiff;
    }
    const timeDiff = dayjs(leftNode?.createdAt || 0).valueOf() - dayjs(rightNode?.createdAt || 0).valueOf();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return left.localeCompare(right);
  });
}

function userName(user?: UserRecord) {
  return user?.nickname || user?.username || '';
}

function formatDateTime(value?: string) {
  if (!value) {
    return '';
  }
  const date = dayjs(value);
  if (date.isSame(dayjs(), 'day')) {
    return `сегодня в ${date.format('HH:mm')}`;
  }
  return date.format('DD.MM.YYYY HH:mm');
}

function lastChangedLabel(node?: ProcessRecord) {
  if (!node || node.inaccessible) {
    return 'Последнее изменение: нет доступа к данным процесса';
  }
  const changedBy = userName(node.updatedBy) || userName(node.createdBy);
  const changedAt = node.updatedAt || node.createdAt;
  if (!changedBy && !changedAt) {
    return 'Последнее изменение не указано';
  }
  return `Последнее изменение: ${changedBy || 'Пользователь'}, ${formatDateTime(changedAt) || 'дата не указана'}`;
}

function normalizeHistoryTitle(value?: string) {
  return String(value || '')
    .replace(/^\s*\d+\s*-\s*/, '')
    .trim();
}

function formatEdgeLabel(info?: EdgeInfo) {
  if (!info?.createdAt && !info?.createdBy) {
    return 'Автор связи не указан';
  }
  return `Связь добавил: ${userName(info.createdBy) || 'Пользователь'}, ${
    formatDateTime(info.createdAt) || 'дата не указана'
  }`;
}

function getData<T>(response: unknown): T {
  const responseRecord = asRecord(response);
  const data = responseRecord.data;
  const dataRecord = asRecord(data);
  return (dataRecord.data ?? data ?? response) as T;
}

function getErrorText(error: unknown, fallback: string): string {
  const errorRecord = asRecord(error);
  const responseData = asRecord(asRecord(errorRecord.response).data);
  const errors = Array.isArray(responseData.errors) ? responseData.errors : [];
  return String(asRecord(errors[0]).message || errorRecord.message || fallback);
}

function useStatusLabels() {
  const collectionManager = useCollectionManager();
  return useMemo(() => {
    try {
      const collection = collectionManager?.getCollection?.(PROCESS_COLLECTION);
      const field =
        collection?.getField?.('status') ||
        collection?.fields?.find?.((item) => item?.name === 'status' || item?.options?.name === 'status');
      const items = field?.uiSchema?.enum || field?.options?.uiSchema?.enum || [];
      return items.reduce<Record<string, string>>((memo, item) => {
        memo[String(item.value)] = item.label;
        return memo;
      }, {});
    } catch {
      return {};
    }
  }, [collectionManager]);
}

function resolveProcessUrl(processId: string) {
  if (typeof window === 'undefined') {
    return '';
  }
  const url = new URL(window.location.href);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  for (let index = 0; index < pathSegments.length - 1; index += 1) {
    const segment = pathSegments[index].toLowerCase();
    if (segment === 'filterbytk' || segment === 'filter-by-tk' || segment === 'filterbytk[]') {
      pathSegments[index + 1] = encodeURIComponent(processId);
      url.pathname = `/${pathSegments.join('/')}`;
      return `${url.pathname}${url.search}${url.hash}`;
    }
  }
  if (url.searchParams.has('filterByTk')) {
    url.searchParams.set('filterByTk', processId);
    return `${url.pathname}${url.search}${url.hash}`;
  }
  url.searchParams.set('filterByTk', processId);
  return `${url.pathname}${url.search}${url.hash}`;
}

const blockClass = css`
  min-height: 260px;
  max-height: 680px;
  overflow: auto;

  .process-tree-shell {
    display: grid;
    gap: 12px;
  }

  .process-tree-heading {
    font-weight: 600;
    color: var(--process-tree-text);
  }

  .process-tree-forest {
    display: grid;
    gap: 10px;
  }

  .process-tree-section {
    display: grid;
    gap: 8px;
  }

  .process-tree-section-title {
    font-weight: 600;
    color: var(--process-tree-text);
  }

  .process-tree-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 8px;
    align-items: start;
  }

  .process-tree-card {
    width: 100%;
    min-width: 0;
    padding: 8px 10px;
    border: 1px solid var(--process-tree-border);
    border-radius: 6px;
    background: var(--process-tree-bg);
    color: var(--process-tree-text);
    text-align: left;
    cursor: pointer;
  }

  .process-tree-card:hover {
    border-color: var(--process-tree-primary);
  }

  .process-tree-current {
    border-color: var(--process-tree-primary);
    background: var(--process-tree-current-bg);
  }

  .process-tree-title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-weight: 600;
    line-height: 1.35;
  }

  .process-tree-meta {
    margin-top: 4px;
    font-size: 12px;
    color: var(--process-tree-text-secondary);
    line-height: 1.45;
  }

  .process-tree-edge {
    margin: 4px 0 6px 24px;
    font-size: 12px;
    color: var(--process-tree-text-tertiary);
  }

  .process-tree-children {
    margin-left: 18px;
    padding-left: 12px;
    border-left: 1px solid var(--process-tree-border-secondary);
    display: grid;
    gap: 6px;
  }

  .process-tree-toggle {
    width: 22px;
    height: 22px;
    padding: 0;
    color: var(--process-tree-text-secondary);
  }
`;

function ProcessTreeBlockComponent({ processId, modelContext }: ProcessTreeBlockProps) {
  const api = useAPIClient();
  const { token } = antdTheme.useToken();
  const statusLabels = useStatusLabels();
  const processTarget = useProcessTarget(modelContext, processId);
  const processKey = processTarget.status === 'ready' ? processTarget.key : undefined;
  const processKeyRef = useRef<ProcessResourceKey | undefined>(processKey);
  processKeyRef.current = processKey;

  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const themeStyle = useMemo(
    () =>
      ({
        '--process-tree-border': token.colorBorder,
        '--process-tree-border-secondary': token.colorBorderSecondary,
        '--process-tree-bg': token.colorBgContainer,
        '--process-tree-current-bg': token.colorFillTertiary,
        '--process-tree-primary': token.colorPrimaryBorder,
        '--process-tree-text': token.colorText,
        '--process-tree-text-secondary': token.colorTextSecondary,
        '--process-tree-text-tertiary': token.colorTextTertiary,
      }) as React.CSSProperties,
    [token],
  );

  const fetchProcess = useCallback(
    async (id: ProcessResourceKey): Promise<ProcessRecord> => {
      const response = await api.resource(PROCESS_COLLECTION).get(
        {
          filterByTk: id,
          appends: ['createdBy', 'updatedBy'],
          fields: ['id', 'title', 'status', 'process_number', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        },
        { skipNotify: true },
      );
      return getData<ProcessRecord>(response);
    },
    [api],
  );

  const fetchRelated = useCallback(
    async (id: string, relation: 'parent_processes' | 'child_processes'): Promise<ProcessRecord[]> => {
      const response = await api.resource(`${PROCESS_COLLECTION}.${relation}`, id).list(
        {
          pageSize: 100,
          appends: ['createdBy', 'updatedBy'],
          fields: ['id', 'title', 'status', 'process_number', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        },
        { skipNotify: true },
      );
      return getData<ProcessRecord[]>(response) || [];
    },
    [api],
  );

  const fetchEdgeInfo = useCallback(
    async (parent: ProcessRecord, child: ProcessRecord, childParentCount: number): Promise<EdgeInfo> => {
      try {
        const response = await api.resource(HISTORY_COLLECTION).list(
          {
            filter: {
              process_id: child.id,
              event_type: 'parent_added',
            },
            pageSize: 50,
            sort: ['-createdAt', '-id'],
            appends: ['createdBy'],
            fields: ['process_id', 'event_type', 'old_value', 'new_value', 'createdAt', 'createdBy'],
          },
          { skipNotify: true },
        );
        const rows = getData<HistoryRow[]>(response) || [];
        const exact = rows.find((item) => item.new_value === parent.title);
        const normalized = rows.find(
          (item) => normalizeHistoryTitle(item.new_value) === normalizeHistoryTitle(parent.title),
        );
        const fallback = childParentCount === 1 ? rows[0] : null;
        const item = exact || normalized || fallback;
        if (!item) {
          return { label: 'Автор связи не указан' };
        }
        return {
          label: formatEdgeLabel(item),
          createdAt: item.createdAt,
          createdBy: item.createdBy,
        };
      } catch {
        return { label: 'Автор связи не указан' };
      }
    },
    [api],
  );

  const loadTree = useCallback(async () => {
    if (isEmptyResourceKey(processKey)) {
      return;
    }

    const rootKey = keyOf(processKey);
    const nextData: TreeData = {
      nodes: new Map(),
      parentsByChild: new Map(),
      childrenByParent: new Map(),
      edgeInfo: new Map(),
      warnings: [],
    };

    const addNode = (node: ProcessRecord) => {
      if (!isEmptyResourceKey(node?.id)) {
        nextData.nodes.set(keyOf(node.id), node);
      }
    };
    const addEdge = (parentId: string, childId: string) => {
      nextData.childrenByParent.set(
        parentId,
        uniqueSorted([...(nextData.childrenByParent.get(parentId) || []), childId], nextData.nodes),
      );
      nextData.parentsByChild.set(
        childId,
        uniqueSorted([...(nextData.parentsByChild.get(childId) || []), parentId], nextData.nodes),
      );
    };

    const visit = async (id: string, direction: LoadDirection, depth: number, path: string[]) => {
      if (depth > MAX_DEPTH) {
        nextData.warnings.push('Отображение остановлено: превышена допустимая глубина дерева.');
        return;
      }
      if (path.includes(id)) {
        return;
      }

      if (!nextData.nodes.has(id)) {
        try {
          addNode(await fetchProcess(id));
        } catch {
          addNode({ id, title: 'Нет доступа к связанному процессу', inaccessible: true });
          return;
        }
      }

      const nextPath = [...path, id];
      if (direction === 'up' || direction === 'both') {
        try {
          const parents = await fetchRelated(id, 'parent_processes');
          parents.forEach((parent) => {
            addNode(parent);
            addEdge(keyOf(parent.id), id);
          });
          for (const parent of parents) {
            await visit(keyOf(parent.id), 'up', depth + 1, nextPath);
          }
        } catch {
          nextData.warnings.push('Нет доступа к связанному процессу');
        }
      }

      if (direction === 'down' || direction === 'both') {
        try {
          const children = await fetchRelated(id, 'child_processes');
          children.forEach((child) => {
            addNode(child);
            addEdge(id, keyOf(child.id));
          });
          for (const child of children) {
            await visit(keyOf(child.id), 'down', depth + 1, nextPath);
          }
        } catch {
          nextData.warnings.push('Нет доступа к связанному процессу');
        }
      }
    };

    await visit(rootKey, 'both', 0, []);

    const initialRootIds = Array.from(nextData.nodes.keys()).filter(
      (id) => !(nextData.parentsByChild.get(id) || []).length,
    );
    const rootsToComplete = initialRootIds.length ? uniqueSorted(initialRootIds, nextData.nodes) : [rootKey];
    for (const rootId of rootsToComplete) {
      await visit(rootId, 'down', 0, []);
    }

    const edgePairs = Array.from(nextData.childrenByParent.entries()).flatMap(([parentId, children]) =>
      children.map((childId) => [parentId, childId] as const),
    );
    for (const [parentId, childId] of edgePairs) {
      const parent = nextData.nodes.get(parentId);
      const child = nextData.nodes.get(childId);
      if (!parent || !child || parent.inaccessible || child.inaccessible) {
        nextData.edgeInfo.set(edgeKey(parentId, childId), { label: 'Автор связи не указан' });
        continue;
      }
      const childParentCount = nextData.parentsByChild.get(childId)?.length || 0;
      nextData.edgeInfo.set(edgeKey(parentId, childId), await fetchEdgeInfo(parent, child, childParentCount));
    }

    nextData.parentsByChild.forEach((ids, id) => nextData.parentsByChild.set(id, uniqueSorted(ids, nextData.nodes)));
    nextData.childrenByParent.forEach((ids, id) =>
      nextData.childrenByParent.set(id, uniqueSorted(ids, nextData.nodes)),
    );

    if (processKeyRef.current === processKey) {
      setTreeData(nextData);
    }
  }, [fetchEdgeInfo, fetchProcess, fetchRelated, processKey]);

  useEffect(() => {
    setTreeData(null);
    setError(null);
    setCollapsed({});
    if (isEmptyResourceKey(processKey)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadTree()
      .catch((err) => {
        if (processKeyRef.current === processKey) {
          setError(getErrorText(err, 'Не удалось загрузить дерево процессов'));
        }
      })
      .finally(() => {
        if (processKeyRef.current === processKey) {
          setLoading(false);
        }
      });
  }, [loadTree, processKey]);

  const navigateToProcess = useCallback(
    (id: string) => {
      if (String(id) === String(processKey)) {
        return;
      }
      const url = resolveProcessUrl(id);
      setTreeData(null);
      setError(null);
      setCollapsed({});
      if (url) {
        window.location.assign(url);
      }
    },
    [processKey],
  );

  const toggleNode = useCallback((id: string) => {
    setCollapsed((current) => ({ ...current, [id]: !current[id] }));
  }, []);

  const getStatusLabel = useCallback(
    (value?: string) => {
      if (!value) {
        return 'не указан';
      }
      return statusLabels[value] || statusFallbackLabels[value] || value;
    },
    [statusLabels],
  );

  const renderCard = useCallback(
    (id: string, options: { current?: boolean; hasChildren?: boolean; forceExpanded?: boolean } = {}) => {
      const node = treeData?.nodes.get(id);
      const isCollapsed = options.forceExpanded ? false : !!collapsed[id];
      const parents = treeData?.parentsByChild.get(id) || [];
      const parentTitles = parents.map((parentId) => treeData?.nodes.get(parentId)?.title).filter(Boolean);
      return (
        <div className="process-tree-row" key={`row-${id}`}>
          {options.hasChildren ? (
            <Button
              className="process-tree-toggle"
              type="text"
              size="small"
              icon={isCollapsed ? <RightOutlined /> : <DownOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                toggleNode(id);
              }}
              aria-label={isCollapsed ? 'Развернуть узел' : 'Свернуть узел'}
            />
          ) : (
            <span style={{ width: 22 }} />
          )}
          <button
            type="button"
            className={`process-tree-card ${options.current ? 'process-tree-current' : ''}`}
            onClick={() => navigateToProcess(id)}
          >
            <div className="process-tree-title">
              <span>{node?.title || 'Нет доступа к связанному процессу'}</span>
              {options.current ? <Tag color="processing">Текущий процесс</Tag> : null}
              {node?.inaccessible ? <Tag>Нет доступа</Tag> : null}
            </div>
            <div className="process-tree-meta">
              Статус: {node?.inaccessible ? 'нет доступа' : getStatusLabel(node?.status)}
            </div>
            <div className="process-tree-meta">{lastChangedLabel(node)}</div>
            {parentTitles.length > 1 ? (
              <div className="process-tree-meta">Родители: {parentTitles.join(', ')}</div>
            ) : null}
          </button>
        </div>
      );
    },
    [collapsed, getStatusLabel, navigateToProcess, toggleNode, treeData],
  );

  const renderEdge = useCallback(
    (parentId: string, childId: string) => {
      const info = treeData?.edgeInfo.get(edgeKey(parentId, childId));
      return (
        <div className="process-tree-edge" key={`edge-${parentId}-${childId}`}>
          <LinkOutlined /> {formatEdgeLabel(info)}
        </div>
      );
    },
    [treeData],
  );

  const rootIds = useMemo(() => {
    if (!treeData || isEmptyResourceKey(processKey)) {
      return [];
    }
    const ids: string[] = Array.from(treeData.nodes.keys()).filter(
      (id) => !(treeData.parentsByChild.get(id) || []).length,
    );
    return ids.length ? uniqueSorted(ids, treeData.nodes) : [keyOf(processKey)];
  }, [processKey, treeData]);

  const expandedAncestorIds = useMemo(() => {
    if (!treeData || isEmptyResourceKey(processKey)) {
      return new Set<string>();
    }
    const ancestors = new Set<string>();
    const visitParents = (id: string, path: string[]) => {
      if (path.includes(id)) {
        return;
      }
      const parents = treeData.parentsByChild.get(id) || [];
      parents.forEach((parentId) => {
        ancestors.add(parentId);
        visitParents(parentId, [...path, id]);
      });
    };
    visitParents(keyOf(processKey), []);
    return ancestors;
  }, [processKey, treeData]);

  const renderBranch = useCallback(
    (id: string, depth = 0, branchPath: string[] = []): React.ReactNode => {
      if (!treeData || depth > MAX_DEPTH) {
        return null;
      }
      if (branchPath.includes(id)) {
        return (
          <Alert
            key={`cycle-${branchPath.join('-')}-${id}`}
            type="warning"
            message="Обнаружена циклическая связь. Часть дерева скрыта."
          />
        );
      }
      const children = treeData.childrenByParent.get(id) || [];
      const isCurrent = String(id) === String(processKey);
      const forceExpanded = isCurrent || expandedAncestorIds.has(id);
      const isCollapsed = forceExpanded ? false : !!collapsed[id];
      return (
        <div key={`branch-${branchPath.join('-')}-${id}`}>
          {renderCard(id, { current: isCurrent, hasChildren: children.length > 0, forceExpanded })}
          {!isCollapsed && children.length ? (
            <div className="process-tree-children">
              {children.map((childId) => (
                <div key={`child-${branchPath.join('-')}-${id}-${childId}`}>
                  {renderEdge(id, childId)}
                  {renderBranch(childId, depth + 1, [...branchPath, id])}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      );
    },
    [collapsed, expandedAncestorIds, processKey, renderCard, renderEdge, treeData],
  );

  if (processTarget.status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
        <Spin indicator={<LoadingOutlined spin />} />
      </div>
    );
  }

  if (processTarget.status !== 'ready') {
    return <Alert type="info" showIcon message="Сначала сохраните процесс, чтобы увидеть дерево связей." />;
  }

  return (
    <div className={blockClass} style={themeStyle}>
      {error ? <Alert type="warning" showIcon message={error} style={{ marginBottom: 12 }} /> : null}
      {loading && !treeData ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
          <Spin indicator={<LoadingOutlined spin />} />
        </div>
      ) : null}
      {!loading && !error && !treeData ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Дерево связей не найдено" />
      ) : null}
      {treeData ? (
        <div className="process-tree-shell">
          <div className="process-tree-heading">Дерево процессов</div>
          {Array.from(new Set(treeData.warnings)).map((warning) => (
            <Alert key={warning} type="warning" showIcon message={warning} />
          ))}
          <div className="process-tree-forest">{rootIds.map((rootId) => renderBranch(rootId, 0, []))}</div>
        </div>
      ) : null}
    </div>
  );
}

export const ProcessTreeBlock = observer(ProcessTreeBlockComponent, {
  displayName: 'ProcessTreeBlock',
});
