/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { CloseOutlined, LoadingOutlined, PaperClipOutlined, SendOutlined, UploadOutlined } from '@ant-design/icons';
import {
  css,
  useAPIClient,
  useCollection,
  useCollectionManager,
  useCollectionRecord,
  useCurrentPopupRecord,
  useCurrentUserContext,
  useDataBlockProps,
  useFormBlockContext,
  useRecord,
} from '@nocobase/client';
import { getInnermostRouteFilterByTk } from '@log-company/plugin-process-governance/client';
import { observer } from '@formily/react';
import {
  Alert,
  Avatar,
  Button,
  Divider,
  Empty,
  Input,
  Space,
  Spin,
  Tooltip,
  Upload,
  message,
  theme as antdTheme,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { UploadProps } from 'antd';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PROCESS_DISCUSSION_ATTACHMENT_PURPOSE,
  PROCESS_DISCUSSION_ATTACHMENT_PURPOSE_FIELD,
} from '../../../../shared/processDiscussionAttachments';

const PAGE_SIZE = 50;
const POLL_INTERVAL = 15000;
const PROCESS_COLLECTION = 'customs_processes';
const COMMENTS_COLLECTION = 'process_comments';
const ASSOCIATION_RESOURCE = 'customs_processes.comments';
const PROCESS_ASSOCIATION_FIELD = 'process';
const PROCESS_FOREIGN_KEY = 'process_id';
const ATTACHMENT_FIELD = 'attachment';

type ProcessResourceKey = string | number;

type ProcessDiscussionModelContext = {
  collection?: unknown;
  record?: Record<string, unknown> | null;
  filterByTk?: unknown;
  params?: Record<string, unknown>;
};

type ProcessDiscussionBlockProps = {
  processId?: ProcessResourceKey | null;
  modelContext?: ProcessDiscussionModelContext;
};

type ProcessTarget =
  | {
      status: 'ready';
      key: ProcessResourceKey;
      source: string;
    }
  | {
      status: 'new' | 'missing' | 'loading';
      key?: undefined;
      source?: string;
    };

type AttachmentRecord = {
  id: number | string;
  title?: string;
  filename?: string;
  url?: string;
  extname?: string;
  size?: number;
};

type DiscussionMessage = {
  id: number | string;
  text?: string;
  createdAt?: string;
  createdBy?: {
    id?: number | string;
    nickname?: string;
    username?: string;
  };
  [ATTACHMENT_FIELD]?: AttachmentRecord[];
};

type ListResult = {
  data: DiscussionMessage[];
  meta?: {
    count?: number;
    page?: number;
    pageSize?: number;
    totalPage?: number;
    hasNext?: boolean;
  };
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
    console.debug(`[process-discussion] Optional NocoBase method ${methodName} is unavailable`, error);
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

function getProcessAssociationValue(processKey: ProcessResourceKey) {
  if (typeof processKey === 'string' && processKey.includes('=')) {
    const params = new URLSearchParams(processKey);
    const values = Array.from(params.entries()).reduce<Record<string, ProcessResourceKey>>((carry, [key, value]) => {
      if (!isEmptyResourceKey(value)) {
        carry[key] = value;
      }
      return carry;
    }, {});
    if (Object.keys(values).length) {
      return values;
    }
  }
  return { id: processKey };
}

function getProcessForeignKeyValue(processKey: ProcessResourceKey) {
  const associationValue = getProcessAssociationValue(processKey);
  if (typeof associationValue === 'object') {
    if (!isEmptyResourceKey(associationValue.id)) {
      return associationValue.id;
    }
    const values = Object.values(associationValue).filter((value) => !isEmptyResourceKey(value));
    if (values.length === 1) {
      return values[0];
    }
  }
  return processKey;
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
    const filterByTk = targetKey.reduce<Record<string, unknown>>((memo, key) => {
      memo[String(key)] = record[String(key)];
      return memo;
    }, {});
    return normalizeFilterByTk(filterByTk);
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

function useProcessTarget(
  modelContext?: ProcessDiscussionModelContext,
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
    {
      source: 'edit-popup',
      collection: popupRecord?.collection,
      record: popupRecord?.value,
    },
    {
      source: 'record-context',
      collection: collection || modelContext?.collection,
      record: recordContext,
    },
    {
      source: 'collection-record',
      collection: collection || dataBlockProps?.collection,
      record: collectionRecord?.data,
      isNew: collectionRecord?.isNew,
    },
    {
      source: 'model-context',
      collection: modelContext?.collection,
      record: modelContext?.record,
    },
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

  const routeKey = normalizeFilterByTk(getInnermostRouteFilterByTk());
  if (!isEmptyResourceKey(routeKey)) {
    return { status: 'ready', key: routeKey, source: 'route' };
  }

  if (formBlockIsUpdate || (dataBlockProps?.action === 'get' && hasProcessContext)) {
    return { status: 'loading', source: 'form-record' };
  }

  return { status: 'missing' };
}

const blockClass = css`
  display: flex;
  flex-direction: column;
  min-height: 360px;
  max-height: 680px;

  .process-discussion-list {
    flex: 1 1 auto;
    min-height: 220px;
    overflow: auto;
    padding: 0 4px 12px;
  }

  .process-discussion-load {
    display: flex;
    justify-content: center;
    padding: 2px 0 12px;
  }

  .process-discussion-date {
    margin: 12px 0;
  }

  .process-discussion-item {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--process-discussion-border);
    border-radius: 6px;
    background: var(--process-discussion-bg);
  }

  .process-discussion-item + .process-discussion-item {
    margin-top: 8px;
  }

  .process-discussion-item-own {
    border-color: var(--process-discussion-own-border);
    background: var(--process-discussion-own-bg);
  }

  .process-discussion-meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 4px;
  }

  .process-discussion-author {
    min-width: 0;
    font-weight: 500;
    color: var(--process-discussion-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .process-discussion-time {
    flex: 0 0 auto;
    font-size: 12px;
    color: var(--process-discussion-text-tertiary);
  }

  .process-discussion-text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--process-discussion-text);
    line-height: 1.55;
  }

  .process-discussion-files {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .process-discussion-file {
    max-width: 260px;
  }

  .process-discussion-file span:last-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .process-discussion-composer {
    flex: 0 0 auto;
    border-top: 1px solid var(--process-discussion-border-secondary);
    padding-top: 12px;
  }

  .process-discussion-composer-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 8px;
    align-items: end;
  }

  .process-discussion-upload {
    max-width: 100%;
    margin-top: 8px;
  }

  .process-discussion-upload-item {
    display: inline-flex;
    align-items: center;
    max-width: min(360px, 100%);
  }

  .process-discussion-upload-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

function normalizeAttachmentUrl(file: AttachmentRecord) {
  if (!file?.url) {
    return '';
  }
  if (file.url.startsWith('http://') || file.url.startsWith('https://')) {
    return file.url;
  }
  return `${window.location.origin}/${file.url.replace(/^\//, '')}`;
}

function getAttachmentTitle(file: AttachmentRecord, fallback: string) {
  return file?.title || file?.filename || fallback;
}

function getAuthorName(messageItem: DiscussionMessage, fallback: string) {
  const user = messageItem.createdBy;
  return user?.nickname || user?.username || fallback;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function getDateLabel(value: string | undefined, todayLabel: string, yesterdayLabel: string) {
  const date = dayjs(value);
  const today = dayjs();
  if (date.isSame(today, 'day')) {
    return todayLabel;
  }
  if (date.isSame(today.subtract(1, 'day'), 'day')) {
    return yesterdayLabel;
  }
  return date.format('DD.MM.YYYY');
}

function sortMessages(data: DiscussionMessage[]) {
  return [...data].sort((a, b) => {
    const timeDiff = dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return String(a.id).localeCompare(String(b.id));
  });
}

function mergeMessages(previous: DiscussionMessage[], incoming: DiscussionMessage[]) {
  const map = new Map<string, DiscussionMessage>();
  [...previous, ...incoming].forEach((item) => {
    map.set(String(item.id), item);
  });
  return sortMessages(Array.from(map.values()));
}

function getUploadedAttachments(fileList: UploadFile[]) {
  return fileList
    .filter((file) => file.status === 'done')
    .map((file) => getUploadedAttachment(file))
    .filter((file) => file?.id);
}

function getUploadedAttachment(file: UploadFile) {
  const response = asRecord(file.response);
  const attachment = asRecord(response.data ?? file.response);
  return Object.keys(attachment).length ? (attachment as AttachmentRecord) : undefined;
}

function getErrorText(error: unknown, fallback: string): string {
  const errorRecord = asRecord(error);
  const responseData = asRecord(asRecord(errorRecord.response).data);
  const errors = Array.isArray(responseData.errors) ? responseData.errors : [];
  return String(asRecord(errors[0]).message || errorRecord.message || fallback);
}

function getRenderableText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return value == null ? undefined : String(value).trim() || undefined;
  }
  return value.trim() || undefined;
}

function useElementVisibility(ref: React.RefObject<HTMLElement>) {
  const [intersecting, setIntersecting] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(
    typeof document === 'undefined' || document.visibilityState === 'visible',
  );

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setIntersecting(entry.isIntersecting);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  useEffect(() => {
    const handleVisibility = () => {
      setDocumentVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return intersecting && documentVisible;
}

function ProcessDiscussionBlockComponent({ processId, modelContext }: ProcessDiscussionBlockProps) {
  const api = useAPIClient();
  const { token } = antdTheme.useToken();
  const currentUser = useCurrentUserContext()?.data?.data;
  const processTarget = useProcessTarget(modelContext, processId);
  const processKey = processTarget.status === 'ready' ? processTarget.key : undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const processKeyRef = useRef<ProcessResourceKey | undefined>(processKey);
  processKeyRef.current = processKey;
  const visible = useElementVisibility(containerRef);
  const [items, setItems] = useState<DiscussionMessage[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loadedPages, setLoadedPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [removingFileUid, setRemovingFileUid] = useState<string | null>(null);
  const themeStyle = useMemo(
    () =>
      ({
        '--process-discussion-border': token.colorBorder,
        '--process-discussion-border-secondary': token.colorBorderSecondary,
        '--process-discussion-bg': token.colorBgContainer,
        '--process-discussion-own-bg': token.colorFillTertiary,
        '--process-discussion-own-border': token.colorPrimaryBorder,
        '--process-discussion-text': token.colorText,
        '--process-discussion-text-tertiary': token.colorTextTertiary,
      }) as React.CSSProperties,
    [token],
  );

  const fetchPage = useCallback(
    async (page: number): Promise<ListResult> => {
      const response = await api.resource(ASSOCIATION_RESOURCE, processKey).list(
        {
          page,
          pageSize: PAGE_SIZE,
          sort: ['-createdAt', '-id'],
          appends: ['createdBy', ATTACHMENT_FIELD],
        },
        { skipNotify: true },
      );
      return {
        data: response?.data?.data || [],
        meta: response?.data?.meta,
      };
    },
    [api, processKey],
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    window.setTimeout(() => {
      const element = listRef.current;
      if (element) {
        element.scrollTo({ top: element.scrollHeight, behavior });
      }
    }, 0);
  }, []);

  const loadLatest = useCallback(
    async ({ replace = false, silent = false, scroll = false } = {}) => {
      if (isEmptyResourceKey(processKey)) {
        return;
      }
      if (!silent) {
        setLoading(true);
      }
      try {
        const result = await fetchPage(1);
        if (processKeyRef.current !== processKey) {
          return;
        }
        const latestAscending = sortMessages(result.data);
        setItems((previous) => (replace ? latestAscending : mergeMessages(previous, latestAscending)));
        setTotalCount(result.meta?.count || latestAscending.length);
        setLoadedPages((previous) => Math.max(previous, 1));
        setError(null);
        if (scroll) {
          scrollToBottom('auto');
        }
      } catch (err) {
        if (processKeyRef.current !== processKey) {
          return;
        }
        setError(getErrorText(err, 'Не удалось загрузить обсуждение.'));
      } finally {
        if (!silent && processKeyRef.current === processKey) {
          setLoading(false);
        }
      }
    },
    [fetchPage, processKey, scrollToBottom],
  );

  useEffect(() => {
    processKeyRef.current = processKey;
    setItems([]);
    setTotalCount(0);
    setLoadedPages(0);
    setLoading(false);
    setLoadingPrevious(false);
    setError(null);
    setText('');
    setFileList([]);
    setRemovingFileUid(null);
    if (!isEmptyResourceKey(processKey)) {
      loadLatest({ replace: true, scroll: true }).catch((error) => {
        setError(getErrorText(error, 'Не удалось загрузить обсуждение.'));
      });
    }
  }, [loadLatest, processKey]);

  useEffect(() => {
    if (isEmptyResourceKey(processKey) || !visible) {
      return;
    }
    const timer = window.setInterval(() => {
      loadLatest({ silent: true }).catch((error) => {
        setError(getErrorText(error, 'Не удалось обновить обсуждение.'));
      });
    }, POLL_INTERVAL);
    return () => window.clearInterval(timer);
  }, [loadLatest, processKey, visible]);

  const loadPrevious = useCallback(async () => {
    if (isEmptyResourceKey(processKey) || loadingPrevious) {
      return;
    }
    setLoadingPrevious(true);
    try {
      const nextPage = loadedPages + 1;
      const result = await fetchPage(nextPage);
      if (processKeyRef.current !== processKey) {
        return;
      }
      setItems((previous) => mergeMessages(sortMessages(result.data), previous));
      setTotalCount(result.meta?.count || totalCount);
      setLoadedPages(nextPage);
      setError(null);
    } catch (err) {
      if (processKeyRef.current !== processKey) {
        return;
      }
      setError(getErrorText(err, 'Не удалось загрузить предыдущие сообщения.'));
    } finally {
      if (processKeyRef.current === processKey) {
        setLoadingPrevious(false);
      }
    }
  }, [fetchPage, loadedPages, loadingPrevious, processKey, totalCount]);

  const uploadRequest = useCallback<NonNullable<UploadProps['customRequest']>>(
    async (options) => {
      const { file, onError, onProgress, onSuccess } = options;
      const formData = new FormData();
      formData.append('file', file);
      formData.append(PROCESS_DISCUSSION_ATTACHMENT_PURPOSE_FIELD, PROCESS_DISCUSSION_ATTACHMENT_PURPOSE);
      try {
        const response = await api.request({
          url: `attachments:create?attachmentField=process_comments.${ATTACHMENT_FIELD}`,
          method: 'post',
          data: formData,
          onUploadProgress: ({ total, loaded }) => {
            if (total) {
              onProgress?.({ percent: Math.round((loaded / total) * 100) }, file);
            }
          },
        });
        onSuccess?.({ data: response?.data?.data }, file);
      } catch (err) {
        onError?.(err);
      }
    },
    [api],
  );

  const removeFile = useCallback(
    async (file: UploadFile) => {
      const uploadedAttachment = getUploadedAttachment(file);
      if (!uploadedAttachment?.id) {
        setFileList((current) => current.filter((item) => item.uid !== file.uid));
        return;
      }

      setRemovingFileUid(file.uid);
      try {
        await api.request({
          url: 'processDiscussionAttachments:discard',
          method: 'post',
          data: { attachmentId: uploadedAttachment.id },
        });
        setFileList((current) => current.filter((item) => item.uid !== file.uid));
      } catch (error) {
        console.warn('[process-discussion] Failed to remove attachment', error);
        message.warning(getErrorText(error, 'Не удалось удалить файл из хранилища. Повторите попытку.'));
      } finally {
        setRemovingFileUid(null);
      }
    },
    [api],
  );

  const uploading = fileList.some((file) => file.status === 'uploading');
  const hasUploadError = fileList.some((file) => file.status === 'error');
  const uploadedAttachments = useMemo(() => getUploadedAttachments(fileList), [fileList]);
  const canSubmit =
    (!!text.trim() || uploadedAttachments.length > 0) &&
    !uploading &&
    !submitting &&
    !hasUploadError &&
    removingFileUid === null;
  const hasMore = totalCount > items.length;

  const submit = useCallback(async () => {
    if (!canSubmit || isEmptyResourceKey(processKey)) {
      if (!text.trim() && uploadedAttachments.length === 0) {
        message.warning('Нельзя отправить пустое сообщение.');
      }
      return;
    }

    setSubmitting(true);
    try {
      const normalizedText = text.trim();
      const processAssociationValue = getProcessAssociationValue(processKey);
      const processForeignKeyValue = getProcessForeignKeyValue(processKey);
      await api.resource(COMMENTS_COLLECTION).create({
        values: {
          [PROCESS_ASSOCIATION_FIELD]: processAssociationValue,
          [PROCESS_FOREIGN_KEY]: processForeignKeyValue,
          text: normalizedText || (uploadedAttachments.length ? ' ' : ''),
          [ATTACHMENT_FIELD]: uploadedAttachments.map((file) => file.id),
        },
        updateAssociationValues: [ATTACHMENT_FIELD],
      });
      if (processKeyRef.current !== processKey) {
        return;
      }
      setText('');
      setFileList([]);
      await loadLatest({ replace: false, silent: true, scroll: true });
      setError(null);
    } catch (err) {
      if (processKeyRef.current !== processKey) {
        return;
      }
      setError(getErrorText(err, 'Не удалось отправить сообщение.'));
    } finally {
      if (processKeyRef.current === processKey) {
        setSubmitting(false);
      }
    }
  }, [api, canSubmit, loadLatest, processKey, text, uploadedAttachments]);

  const groupedItems = useMemo(() => {
    const groups: { label: string; items: DiscussionMessage[] }[] = [];
    items.forEach((item) => {
      const label = getDateLabel(item.createdAt, 'Сегодня', 'Вчера');
      let group = groups[groups.length - 1];
      if (!group || group.label !== label) {
        group = { label, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    });
    return groups;
  }, [items]);

  if (processTarget.status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
        <Spin indicator={<LoadingOutlined spin />} />
      </div>
    );
  }

  if (processTarget.status !== 'ready') {
    return <Alert type="info" showIcon message="Сначала сохраните процесс, чтобы открыть обсуждение." />;
  }

  return (
    <div ref={containerRef} className={blockClass} style={themeStyle}>
      {error ? <Alert type="warning" showIcon message={error} style={{ marginBottom: 12 }} /> : null}
      <div ref={listRef} className="process-discussion-list">
        {hasMore ? (
          <div className="process-discussion-load">
            <Button size="small" loading={loadingPrevious} onClick={loadPrevious}>
              Загрузить предыдущие
            </Button>
          </div>
        ) : null}
        {loading && items.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Spin indicator={<LoadingOutlined spin />} />
          </div>
        ) : null}
        {!loading && items.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Сообщений пока нет" />
        ) : null}
        {groupedItems.map((group) => (
          <React.Fragment key={group.label}>
            <Divider plain className="process-discussion-date">
              {group.label}
            </Divider>
            {group.items.map((item) => {
              const authorName = getAuthorName(item, 'Пользователь');
              const isOwn = currentUser?.id != null && String(currentUser.id) === String(item.createdBy?.id);
              const attachments = Array.isArray(item[ATTACHMENT_FIELD]) ? item[ATTACHMENT_FIELD] : [];
              const textContent = getRenderableText(item.text);
              return (
                <div
                  key={String(item.id)}
                  className={`process-discussion-item ${isOwn ? 'process-discussion-item-own' : ''}`}
                >
                  <Avatar size={32}>{getInitials(authorName) || '?'}</Avatar>
                  <div style={{ minWidth: 0 }}>
                    <div className="process-discussion-meta">
                      <span className="process-discussion-author" title={authorName}>
                        {authorName}
                      </span>
                      <Tooltip title={dayjs(item.createdAt).format('DD.MM.YYYY HH:mm:ss')}>
                        <span className="process-discussion-time">{dayjs(item.createdAt).format('HH:mm')}</span>
                      </Tooltip>
                    </div>
                    {textContent ? <div className="process-discussion-text">{textContent}</div> : null}
                    {attachments.length ? (
                      <div className="process-discussion-files">
                        {attachments.map((file) => {
                          const url = normalizeAttachmentUrl(file);
                          const title = getAttachmentTitle(file, `Файл ${file?.id || ''}`.trim());
                          return (
                            <Button
                              key={String(file.id)}
                              className="process-discussion-file"
                              size="small"
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              icon={<PaperClipOutlined />}
                            >
                              {title}
                            </Button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="process-discussion-composer">
        <div className="process-discussion-composer-row">
          <Upload
            multiple
            fileList={fileList}
            customRequest={uploadRequest}
            showUploadList={false}
            onChange={({ fileList: nextFileList }) => setFileList(nextFileList)}
          >
            <Button icon={<UploadOutlined />}>Прикрепить файл</Button>
          </Upload>
          <Input.TextArea
            autoSize={{ minRows: 1, maxRows: 5 }}
            value={text}
            placeholder="Написать сообщение..."
            onChange={(event) => setText(event.target.value)}
            onPressEnter={(event) => {
              if (!event.shiftKey) {
                event.preventDefault();
                submit().catch((error) => setError(getErrorText(error, 'Не удалось отправить сообщение.')));
              }
            }}
          />
          <Button type="primary" icon={<SendOutlined />} disabled={!canSubmit} loading={submitting} onClick={submit}>
            Отправить
          </Button>
        </div>
        {fileList.length ? (
          <div className="process-discussion-upload">
            <Space size={6} wrap>
              {fileList.map((file) => (
                <Tooltip key={file.uid} title={file.name}>
                  <Space.Compact className="process-discussion-upload-item">
                    <Button
                      size="small"
                      icon={file.status === 'uploading' ? <LoadingOutlined /> : <PaperClipOutlined />}
                      danger={file.status === 'error'}
                    >
                      <span className="process-discussion-upload-name">{file.name}</span>
                    </Button>
                    <Button
                      size="small"
                      icon={removingFileUid === file.uid ? <LoadingOutlined /> : <CloseOutlined />}
                      aria-label={`Убрать файл ${file.name}`}
                      disabled={file.status === 'uploading' || removingFileUid !== null}
                      onClick={() => removeFile(file)}
                    />
                  </Space.Compact>
                </Tooltip>
              ))}
            </Space>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const ProcessDiscussionBlock = observer(ProcessDiscussionBlockComponent, {
  displayName: 'ProcessDiscussionBlock',
});
