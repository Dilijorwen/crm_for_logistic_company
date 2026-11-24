/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { CloseOutlined, LoadingOutlined, PaperClipOutlined, SendOutlined, UploadOutlined } from '@ant-design/icons';
import { css, useAPIClient, useCurrentUserContext } from '@nocobase/client';
import {
  useShipmentTarget as useProcessTarget,
  isEmptyResourceKey,
  asRecord,
  type ProcessModelContext as ProcessDiscussionModelContext,
} from '@log-company/plugin-process-governance/client';
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
  createDiscussionComment,
  WorkspaceDiscussionApi,
  compareMessageIds,
  type WorkspaceDiscussionMessage,
} from '../../../entities/discussion';
import {
  PROCESS_DISCUSSION_ATTACHMENT_PURPOSE,
  PROCESS_DISCUSSION_ATTACHMENT_PURPOSE_FIELD,
} from '../../../../shared/processDiscussionAttachments';

const PAGE_SIZE = 50;
const POLL_INTERVAL = 15000;
const PROCESS_COLLECTION = 'shipments';
const ASSOCIATION_RESOURCE = 'shipments.comments';
const ATTACHMENT_FIELD = 'attachment';

type ProcessResourceKey = string | number;

type ProcessDiscussionBlockProps = {
  processId?: ProcessResourceKey | null;
  modelContext?: ProcessDiscussionModelContext;
  workspace?: { entity: 'run' | 'shipment'; id: ProcessResourceKey };
};

type AttachmentRecord = {
  id: number | string;
  title?: string;
  filename?: string;
  url?: string;
  extname?: string;
  size?: number;
};

type DiscussionMessage = WorkspaceDiscussionMessage;

type ListResult = {
  data: DiscussionMessage[];
  scopeKey?: string;
  meta?: {
    count?: number;
    page?: number;
    pageSize?: number;
    totalPage?: number;
    hasNext?: boolean;
  };
};

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
    return compareMessageIds(a.id, b.id) || (a.messageKey ?? '').localeCompare(b.messageKey ?? '');
  });
}

function mergeMessages(previous: DiscussionMessage[], incoming: DiscussionMessage[]) {
  const map = new Map<string, DiscussionMessage>();
  [...previous, ...incoming].forEach((item) => {
    map.set(item.messageKey ?? String(item.id), item);
  });
  return sortMessages(Array.from(map.values()));
}

function getUploadedAttachments(fileList: UploadFile[]) {
  return fileList
    .filter((file) => file.status === 'done')
    .map((file) => getUploadedAttachment(file))
    .filter((file): file is AttachmentRecord => !!file?.id);
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

function ProcessDiscussionBlockComponent({ processId, modelContext, workspace }: ProcessDiscussionBlockProps) {
  const api = useAPIClient();
  const { token } = antdTheme.useToken();
  const currentUser = useCurrentUserContext()?.data?.data;
  const processTarget = useProcessTarget(modelContext, processId);
  const workspaceId = workspace?.id;
  const workspaceEntity = workspace?.entity;
  const workspaceApi = useMemo(() => new WorkspaceDiscussionApi(api), [api]);
  const scopeKey = useRef<string>();
  const processKey = workspaceId ?? (processTarget.status === 'ready' ? processTarget.key : undefined);
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
      if (workspaceEntity && workspaceId != null)
        return workspaceApi.list(workspaceEntity, workspaceId, page, PAGE_SIZE);
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
    [api, processKey, workspaceApi, workspaceEntity, workspaceId],
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
        const scopeChanged = result.scopeKey !== scopeKey.current;
        scopeKey.current = result.scopeKey;
        setItems((previous) => (replace || scopeChanged ? latestAscending : mergeMessages(previous, latestAscending)));
        setTotalCount(result.meta?.count ?? latestAscending.length);
        setLoadedPages((previous) => (scopeChanged ? 1 : Math.max(previous, 1)));
        setError(null);
        if (scroll) {
          scrollToBottom('auto');
        }
      } catch (err) {
        if (processKeyRef.current !== processKey) {
          return;
        }
        if (workspaceEntity) {
          scopeKey.current = undefined;
          setItems([]);
          setTotalCount(0);
          setLoadedPages(0);
        }
        setError(getErrorText(err, 'Не удалось загрузить обсуждение.'));
      } finally {
        if (!silent && processKeyRef.current === processKey) {
          setLoading(false);
        }
      }
    },
    [fetchPage, processKey, scrollToBottom, workspaceEntity],
  );

  useEffect(() => {
    processKeyRef.current = processKey;
    scopeKey.current = undefined;
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
      if (result.scopeKey !== scopeKey.current) {
        await loadLatest({ replace: true });
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
  }, [fetchPage, loadedPages, loadingPrevious, loadLatest, processKey, totalCount]);

  const uploadRequest = useCallback<NonNullable<UploadProps['customRequest']>>(
    async (options) => {
      const { file, onError, onProgress, onSuccess } = options;
      const formData = new FormData();
      formData.append('file', file);
      formData.append(PROCESS_DISCUSSION_ATTACHMENT_PURPOSE_FIELD, PROCESS_DISCUSSION_ATTACHMENT_PURPOSE);
      try {
        const response = await api.request({
          url: `attachments:create?attachmentField=shipment_comments.${ATTACHMENT_FIELD}`,
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
        onError?.(err instanceof Error ? err : new Error('Не удалось загрузить вложение'));
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
      const attachmentIds = uploadedAttachments.map((file) => file.id);
      if (workspaceEntity === 'run') {
        await workspaceApi.send(processKey, normalizedText, attachmentIds);
      } else {
        const processAssociationValue = getProcessAssociationValue(processKey);
        const processForeignKeyValue = getProcessForeignKeyValue(processKey);
        await createDiscussionComment(api, {
          shipment: processAssociationValue,
          shipment_id: processForeignKeyValue,
          text: normalizedText || (attachmentIds.length ? ' ' : ''),
          attachment: attachmentIds,
        });
      }
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
  }, [api, canSubmit, loadLatest, processKey, text, uploadedAttachments, workspaceApi, workspaceEntity]);

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

  if (!workspaceEntity && processTarget.status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
        <Spin indicator={<LoadingOutlined spin />} />
      </div>
    );
  }

  if (!workspaceEntity && processTarget.status !== 'ready') {
    return <Alert type="info" showIcon message="Сначала сохраните поставку, чтобы открыть обсуждение." />;
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
                  key={item.messageKey ?? String(item.id)}
                  className={`process-discussion-item ${isOwn ? 'process-discussion-item-own' : ''}`}
                >
                  <Avatar size={32}>{getInitials(authorName) || '?'}</Avatar>
                  <div style={{ minWidth: 0 }}>
                    <div className="process-discussion-meta">
                      <span className="process-discussion-author" title={authorName}>
                        {authorName}
                        {item.source && ` · ${item.source}`}
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
