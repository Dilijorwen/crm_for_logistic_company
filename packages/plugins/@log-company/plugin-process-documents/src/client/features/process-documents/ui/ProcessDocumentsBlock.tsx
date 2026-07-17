import {
  DeleteOutlined,
  DownOutlined,
  DownloadOutlined,
  FileOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  LoadingOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
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
import { Alert, Button, Dropdown, Empty, Modal, Spin, Tooltip, message, theme as antdTheme } from 'antd';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ensureProcessDocumentsDraftToken } from '../model/draftToken';

const PROCESS_COLLECTION = 'customs_processes';

type ProcessResourceKey = string | number;

type ProcessDocumentsModelContext = {
  collection?: unknown;
  record?: Record<string, unknown> | null;
  filterByTk?: unknown;
  params?: Record<string, unknown>;
  model?: unknown;
};

type ProcessTarget =
  | { status: 'ready'; key: ProcessResourceKey; source: string }
  | { status: 'new' | 'missing' | 'loading'; key?: undefined; source?: string };

type FolderItem = {
  id: string | number;
  title: string;
  createdAt?: string;
  author?: string;
};

type FileItem = {
  id: string | number;
  title: string;
  original_filename?: string;
  mime_type?: string;
  file_size?: number;
  createdAt?: string;
  author?: string;
};

type Breadcrumb = {
  id: string | number;
  title: string;
};

type DocumentsListResponse = {
  breadcrumbs?: Breadcrumb[];
  folders?: FolderItem[];
  files?: FileItem[];
  permissions?: { canWrite?: boolean; canDelete?: boolean };
};

type FolderDeleteSummary = {
  folders?: number;
  files?: number;
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
    console.debug(`[process-documents] Optional NocoBase method ${methodName} is unavailable`, error);
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

function isProcessCreatePopupModel(model: unknown) {
  let cursor = model;
  const seen = new Set<unknown>();
  for (let depth = 0; cursor && depth < 24 && !seen.has(cursor); depth += 1) {
    seen.add(cursor);
    const cursorRecord = asRecord(cursor);
    const stepParams = asRecord(cursorRecord.stepParams);
    const createCollection =
      asRecord(asRecord(stepParams.resourceSettings).init).collectionName ||
      asRecord(asRecord(stepParams.popupSettings).openView).collectionName ||
      asRecord(cursorRecord.props).collection ||
      asRecord(cursorRecord.context).collectionName;
    if (
      (cursorRecord.use === 'CreateFormModel' || cursorRecord.use === 'AddNewActionModel') &&
      createCollection === PROCESS_COLLECTION
    ) {
      return true;
    }
    cursor =
      cursorRecord.parent ||
      (cursorRecord.parentId
        ? callMethod(cursorRecord.flowEngine, 'getModel', cursorRecord.parentId, true)
        : undefined);
  }
  return false;
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
  modelContext?: ProcessDocumentsModelContext,
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
  const blockIsInProcessCreatePopup = isProcessCreatePopupModel(modelContext?.model);

  if (formBlockIsCreate || blockIsInProcessCreatePopup) {
    return { status: 'new', source: formBlockIsCreate ? 'form-create' : 'create-popup' };
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

function getResponseData<T>(response: unknown): T {
  const responseRecord = asRecord(response);
  const data = responseRecord.data;
  const dataRecord = asRecord(data);
  return asRecord(dataRecord.data ?? data ?? response) as T;
}

function formatSize(value?: number) {
  const size = Number(value || 0);
  if (size < 1024) {
    return `${size} Б`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} КБ`;
  }
  if (size < 1024 * 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} МБ`;
  }
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} ГБ`;
}

function formatDate(value?: string) {
  return value ? dayjs(value).format('DD.MM.YYYY HH:mm') : '';
}

function getErrorText(error: unknown, fallback: string) {
  const errorRecord = asRecord(error);
  const responseData = asRecord(asRecord(errorRecord.response).data);
  const errors = Array.isArray(responseData.errors) ? responseData.errors : [];
  return String(asRecord(errors[0]).message || responseData.message || errorRecord.message || fallback);
}

const blockClass = css`
  min-height: 320px;
  max-height: 680px;
  overflow: auto;

  .process-documents-shell {
    display: grid;
    gap: 12px;
  }

  .process-documents-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .process-documents-breadcrumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    color: var(--process-documents-text-secondary);
    font-size: 13px;
  }

  .process-documents-crumb {
    color: var(--process-documents-primary);
    border: 0;
    padding: 0;
    height: auto;
  }

  .process-documents-list {
    border: 1px solid var(--process-documents-border);
    border-radius: 6px;
    background: var(--process-documents-bg);
    overflow: hidden;
  }

  .process-documents-row {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) 110px 160px minmax(100px, 140px) auto;
    gap: 12px;
    align-items: center;
    min-height: 44px;
    padding: 7px 10px;
    border-bottom: 1px solid var(--process-documents-border-secondary);
    background: var(--process-documents-bg);
    transition: background-color 0.15s ease;
  }

  .process-documents-row:hover {
    background: var(--process-documents-row-hover);
  }

  .process-documents-row:last-child {
    border-bottom: 0;
  }

  .process-documents-name {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    gap: 8px;
    color: var(--process-documents-text);
  }

  button.process-documents-name {
    width: 100%;
    border: 0;
    background: transparent;
    padding: 0;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  button.process-documents-name:hover {
    color: var(--process-documents-primary);
  }

  .process-documents-name-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .process-documents-meta {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--process-documents-text-secondary);
    font-size: 12px;
  }

  .process-documents-actions {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
  }

  @media (max-width: 760px) {
    .process-documents-row {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px;
    }

    .process-documents-meta {
      display: none;
    }
  }
`;

function ProcessDocumentsBlockComponent({
  processId,
  modelContext,
}: {
  processId?: ProcessResourceKey | null;
  modelContext?: ProcessDocumentsModelContext;
}) {
  const api = useAPIClient();
  const { token } = antdTheme.useToken();
  const processTarget: ProcessTarget = useProcessTarget(modelContext, processId);
  const processKey = processTarget.status === 'ready' ? processTarget.key : undefined;
  const [draftToken, setDraftToken] = useState<string>();
  const [folderId, setFolderId] = useState<string | number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const themeStyle = useMemo(
    () =>
      ({
        '--process-documents-border': token.colorBorder,
        '--process-documents-border-secondary': token.colorBorderSecondary,
        '--process-documents-bg': token.colorBgContainer,
        '--process-documents-primary': token.colorPrimary,
        '--process-documents-row-hover': token.colorBgTextHover,
        '--process-documents-text': token.colorText,
        '--process-documents-text-secondary': token.colorTextSecondary,
      }) as React.CSSProperties,
    [token],
  );

  useEffect(() => {
    if (processTarget.status === 'new') {
      setDraftToken(ensureProcessDocumentsDraftToken());
      return;
    }
    setDraftToken(undefined);
  }, [processTarget.status]);

  const requestScope = useMemo(() => {
    if (!isEmptyResourceKey(processKey)) {
      return { processId: processKey };
    }
    if (processTarget.status === 'new' && draftToken) {
      return { draftToken };
    }
    return null;
  }, [draftToken, processKey, processTarget.status]);

  const scopeKey = requestScope?.processId
    ? `process:${requestScope.processId}`
    : requestScope?.draftToken
      ? `draft:${requestScope.draftToken}`
      : '';
  const effectiveCanWrite = canWrite;

  const load = useCallback(async () => {
    if (!requestScope) {
      return;
    }
    setLoading(true);
    try {
      const response = await api.request({
        url: 'processDocuments:list',
        method: 'post',
        data: { ...requestScope, folderId },
      });
      const data = getResponseData<DocumentsListResponse>(response);
      setBreadcrumbs(data.breadcrumbs || []);
      setFolders(data.folders || []);
      setFiles(data.files || []);
      setCanWrite(!!data.permissions?.canWrite);
      setCanDelete(!!data.permissions?.canDelete);
      setError(null);
    } catch (err) {
      setError(getErrorText(err, 'Не удалось загрузить документы процесса'));
      setCanWrite(false);
      setCanDelete(false);
    } finally {
      setLoading(false);
    }
  }, [api, folderId, requestScope]);

  useEffect(() => {
    setFolderId(null);
    setBreadcrumbs([]);
    setFolders([]);
    setFiles([]);
    setCanWrite(false);
    setCanDelete(false);
    setError(null);
  }, [scopeKey]);

  useEffect(() => {
    load().catch((loadError) => setError(getErrorText(loadError, 'Не удалось загрузить документы процесса')));
  }, [load]);

  const uploadFiles = useCallback(
    async (selectedFiles: FileList | null) => {
      if (!selectedFiles?.length || !requestScope) {
        return;
      }
      const formData = new FormData();
      if (requestScope.processId) {
        formData.append('processId', String(requestScope.processId));
      } else if (requestScope.draftToken) {
        formData.append('draftToken', requestScope.draftToken);
      }
      if (!isEmptyResourceKey(folderId)) {
        formData.append('folderId', String(folderId));
      }
      Array.from(selectedFiles).forEach((file) => {
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        formData.append('files', file, relativePath);
      });
      setUploading(true);
      try {
        await api.request({
          url: 'processDocuments:uploadFiles',
          method: 'post',
          data: formData,
        });
        await load();
      } catch (err) {
        message.error(getErrorText(err, 'Не удалось загрузить файлы'));
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        if (folderInputRef.current) {
          folderInputRef.current.value = '';
        }
      }
    },
    [api, folderId, load, requestScope],
  );

  const downloadFile = useCallback(
    (file: FileItem) => {
      const params = new URLSearchParams({ documentId: String(file.id) });
      if (requestScope?.draftToken) {
        params.set('draftToken', requestScope.draftToken);
      }
      window.location.href = `/api/processDocuments:download?${params.toString()}`;
    },
    [requestScope],
  );

  const uploadMenu = useMemo(
    () => ({
      items: [
        { key: 'files', label: 'Файлы' },
        { key: 'folder', label: 'Папку' },
      ],
      onClick: ({ key }: { key: string }) => {
        if (key === 'folder') {
          folderInputRef.current?.click();
          return;
        }
        fileInputRef.current?.click();
      },
    }),
    [],
  );

  const deleteFile = useCallback(
    (file: FileItem) => {
      Modal.confirm({
        title: `Удалить файл «${file.title}»?`,
        content: 'Файл будет безвозвратно удалён из CRM и MinIO. Восстановить его будет невозможно.',
        okText: 'Удалить',
        okButtonProps: { danger: true },
        cancelText: 'Отмена',
        onOk: async () => {
          await api.request({
            url: 'processDocuments:deleteFile',
            method: 'post',
            data: { documentId: file.id, draftToken: requestScope?.draftToken },
          });
          await load();
        },
      });
    },
    [api, load, requestScope],
  );

  const deleteFolder = useCallback(
    async (folder: FolderItem) => {
      try {
        const response = await api.request({
          url: 'processDocuments:folderDeleteSummary',
          method: 'post',
          data: { folderId: folder.id, draftToken: requestScope?.draftToken },
        });
        const summary = getResponseData<FolderDeleteSummary>(response);
        Modal.confirm({
          title: `Удалить папку «${folder.title}»?`,
          content: `Будут удалены папка «${folder.title}», ${summary.folders || 0} вложенных папок и ${
            summary.files || 0
          } файлов. Все файлы будут безвозвратно удалены из MinIO.`,
          okText: 'Удалить папку',
          okButtonProps: { danger: true },
          cancelText: 'Отмена',
          onOk: async () => {
            await api.request({
              url: 'processDocuments:deleteFolder',
              method: 'post',
              data: { folderId: folder.id, draftToken: requestScope?.draftToken },
            });
            await load();
          },
        });
      } catch (err) {
        message.error(getErrorText(err, 'Не удалось подготовить удаление папки'));
      }
    },
    [api, load, requestScope],
  );

  if (processTarget.status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
        <Spin indicator={<LoadingOutlined spin />} />
      </div>
    );
  }

  if (processTarget.status !== 'ready' && processTarget.status !== 'new') {
    return <Alert type="info" showIcon message="Сначала сохраните процесс, чтобы открыть документы." />;
  }

  return (
    <div className={blockClass} style={themeStyle}>
      <div className="process-documents-shell">
        {error ? <Alert type="warning" showIcon message={error} /> : null}
        {processTarget.status === 'new' ? (
          <Alert type="info" showIcon message="Документы будут прикреплены к процессу после сохранения формы." />
        ) : null}
        <div className="process-documents-toolbar">
          {effectiveCanWrite ? (
            <Dropdown menu={uploadMenu} trigger={['click']}>
              <Button icon={<UploadOutlined />} loading={uploading}>
                Загрузить <DownOutlined />
              </Button>
            </Dropdown>
          ) : null}
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>
            Обновить
          </Button>
          <input ref={fileInputRef} type="file" multiple hidden onChange={(event) => uploadFiles(event.target.files)} />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            hidden
            webkitdirectory="true"
            onChange={(event) => uploadFiles(event.target.files)}
          />
        </div>

        <div className="process-documents-breadcrumbs">
          <Button type="link" className="process-documents-crumb" onClick={() => setFolderId(null)}>
            Документы
          </Button>
          {breadcrumbs.map((crumb) => (
            <React.Fragment key={String(crumb.id)}>
              <span>/</span>
              <Button type="link" className="process-documents-crumb" onClick={() => setFolderId(crumb.id)}>
                {crumb.title}
              </Button>
            </React.Fragment>
          ))}
        </div>

        <div className="process-documents-list">
          {loading && !folders.length && !files.length ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Spin indicator={<LoadingOutlined spin />} />
            </div>
          ) : null}
          {!loading && !folders.length && !files.length ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Документов пока нет" />
          ) : null}
          {folderId ? (
            <div className="process-documents-row">
              <button
                type="button"
                className="process-documents-name"
                onClick={() => setFolderId(breadcrumbs.at(-2)?.id || null)}
              >
                <FolderOpenOutlined />
                <span className="process-documents-name-text">..</span>
              </button>
              <span className="process-documents-meta" />
              <span className="process-documents-meta" />
              <span className="process-documents-meta" />
              <span />
            </div>
          ) : null}
          {folders.map((folder) => (
            <div key={`folder-${folder.id}`} className="process-documents-row">
              <button type="button" className="process-documents-name" onClick={() => setFolderId(folder.id)}>
                <FolderOutlined />
                <span className="process-documents-name-text" title={folder.title}>
                  {folder.title}
                </span>
              </button>
              <span className="process-documents-meta">Папка</span>
              <span className="process-documents-meta">{formatDate(folder.createdAt)}</span>
              <span className="process-documents-meta">{folder.author || 'Пользователь'}</span>
              <span className="process-documents-actions">
                {canDelete ? (
                  <Tooltip title="Удалить папку">
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteFolder(folder)} />
                  </Tooltip>
                ) : null}
              </span>
            </div>
          ))}
          {files.map((file) => (
            <div key={`file-${file.id}`} className="process-documents-row">
              <span className="process-documents-name">
                <FileOutlined />
                <span className="process-documents-name-text" title={file.title}>
                  {file.title}
                </span>
              </span>
              <span className="process-documents-meta">{formatSize(file.file_size)}</span>
              <span className="process-documents-meta">{formatDate(file.createdAt)}</span>
              <span className="process-documents-meta">{file.author || 'Пользователь'}</span>
              <span className="process-documents-actions">
                <Tooltip title="Скачать">
                  <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadFile(file)} />
                </Tooltip>
                {canDelete ? (
                  <Tooltip title="Удалить">
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteFile(file)} />
                  </Tooltip>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const ProcessDocumentsBlock = observer(ProcessDocumentsBlockComponent);
