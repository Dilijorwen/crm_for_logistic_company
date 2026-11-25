/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useEffect, useState } from 'react';
import { useAPIClient } from '@nocobase/client';
import { Alert, Button, Space, message } from 'antd';
import {
  catalogNodeTitle,
  type CatalogSearchHit,
  type CatalogSearchRequest,
} from '../../../../contracts/documentCatalog';
import { getDocumentErrorText, ProcessDocumentsApi, RecordAttachmentsApi } from '../../../entities/process-document';
import { DocumentsList } from './DocumentsList';
import { DocumentPreviewDialog, downloadDocument, type DocumentPreviewTarget } from './DocumentPreviewDialog';
import { blockClass, useDocumentsTheme } from './styles';

export function CatalogFileSearchResults({
  api,
  request,
  isVirtual,
  openFolder,
}: {
  api: ProcessDocumentsApi;
  request: CatalogSearchRequest;
  isVirtual: boolean;
  openFolder: (file: CatalogSearchHit) => void;
}) {
  const client = useAPIClient();
  const style = useDocumentsTheme();
  const [results, setResults] = useState<CatalogSearchHit[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [next, setNext] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(!isVirtual);
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState<DocumentPreviewTarget>();
  const requestKey = JSON.stringify(request);

  useEffect(() => {
    if (isVirtual) return;
    const controller = new AbortController();
    async function load() {
      try {
        const result = await api.search(
          { ...(JSON.parse(requestKey) as CatalogSearchRequest), cursor },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setResults((previous) => (cursor ? [...previous, ...result.rows] : result.rows));
        setNext(result.next);
      } catch (reason) {
        if (!controller.signal.aborted) setError(getDocumentErrorText(reason, 'Не удалось выполнить поиск.'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    const timer = setTimeout(load, cursor ? 0 : 280);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [api, requestKey, cursor, attempt, isVirtual]);

  function target(file: CatalogSearchHit): DocumentPreviewTarget {
    if (file.target.kind === 'attachment') {
      const { collection, ownerId } = file.target;
      const attachments = new RecordAttachmentsApi(client, collection, ownerId, 'documents', true, 'main');
      return { name: file.title, load: (signal) => attachments.open(file.id, signal) };
    }
    return {
      name: file.title,
      load: async (signal) => {
        const response = await client.request<Blob>({
          url: 'processDocuments:download',
          method: 'get',
          params: { documentId: file.id },
          responseType: 'blob',
          signal,
        });
        return response.data;
      },
    };
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {error && (
        <Alert
          showIcon
          type="error"
          message={error}
          action={
            <Button
              onClick={() => {
                setError(undefined);
                setLoading(true);
                setAttempt(attempt + 1);
              }}
            >
              Повторить
            </Button>
          }
        />
      )}
      {(!error || results.length > 0) && (
        <div className={blockClass} style={style} aria-busy={loading}>
          <DocumentsList
            compactActions
            allowDraftDrop={false}
            files={results}
            fileKey={(file) => `${file.target.kind}:${file.id}`}
            loading={loading}
            emptyDescription="Файлы не найдены"
            previewFile={(file) => setPreview(target(file))}
            downloadFile={async (file) => {
              try {
                downloadDocument(await target(file).load(), file.title);
              } catch (reason) {
                message.error(getDocumentErrorText(reason, 'Не удалось скачать документ.'));
              }
            }}
            fileLocations={{
              label: (file) =>
                [...file.nodes.map(catalogNodeTitle), ...file.folders.map(({ title }) => title)].join(' / '),
              open: openFolder,
            }}
          />
        </div>
      )}
      {next && !error && (
        <Button
          loading={loading}
          onClick={() => {
            setLoading(true);
            setCursor(next);
          }}
        >
          Показать ещё
        </Button>
      )}
      {preview && <DocumentPreviewDialog file={preview} onClose={() => setPreview(undefined)} />}
    </Space>
  );
}
