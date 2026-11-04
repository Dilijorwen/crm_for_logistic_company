/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DownOutlined, LoadingOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { useAPIClient } from '@nocobase/client';
import { observer } from '@formily/react';
import { Alert, Button, Dropdown, Modal, Spin, message, theme as antdTheme } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ensureProcessDocumentsDraftToken,
  ProcessDocumentsApi,
  type DocumentFolderDto as FolderItem,
  type ProcessDocumentDto as FileItem,
  type DocumentRequestScope,
  useDocumentsList,
  getDocumentErrorText as getErrorText,
} from '../../../entities/process-document';
import {
  useProcessTarget,
  isEmptyResourceKey,
  type ProcessDocumentsModelContext,
  type ProcessTarget,
} from '../model/useProcessTarget';

import { blockClass } from './styles';
import { DocumentsList } from './DocumentsList';

type ProcessResourceKey = string | number;

const directoryInputProps: React.InputHTMLAttributes<HTMLInputElement> & { webkitdirectory: string } = {
  webkitdirectory: 'true',
};

function ProcessDocumentsBlockComponent({
  shipmentId,
  modelContext,
}: {
  shipmentId?: ProcessResourceKey | null;
  modelContext?: ProcessDocumentsModelContext;
}) {
  const apiClient = useAPIClient();
  const api = useMemo(() => new ProcessDocumentsApi(apiClient), [apiClient]);
  const { token } = antdTheme.useToken();
  const processTarget: ProcessTarget = useProcessTarget(modelContext, shipmentId);
  const processKey = processTarget.status === 'ready' ? processTarget.key : undefined;
  const [draftToken, setDraftToken] = useState<string>();
  const [uploading, setUploading] = useState(false);
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

  const requestScope = useMemo<DocumentRequestScope | null>(() => {
    if (!isEmptyResourceKey(processKey)) {
      return { shipmentId: processKey };
    }
    if (processTarget.status === 'new' && draftToken) {
      return { draftToken };
    }
    return null;
  }, [draftToken, processKey, processTarget.status]);

  const {
    breadcrumbs,
    folders,
    files,
    canWrite: effectiveCanWrite,
    canDelete,
    loading,
    error,
    folderId,
    setFolderId,
    load,
  } = useDocumentsList(api, requestScope);

  const uploadFiles = useCallback(
    async (selectedFiles: FileList | null) => {
      if (!selectedFiles?.length || !requestScope) {
        return;
      }
      setUploading(true);
      try {
        await api.upload(requestScope, folderId, Array.from(selectedFiles));
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
          await api.deleteFile(file.id, requestScope?.draftToken);
          await load();
        },
      });
    },
    [api, load, requestScope],
  );

  const deleteFolder = useCallback(
    async (folder: FolderItem) => {
      try {
        const summary = await api.folderDeleteSummary(folder.id, requestScope?.draftToken);
        Modal.confirm({
          title: `Удалить папку «${folder.title}»?`,
          content: `Будут удалены папка «${folder.title}», ${summary.folders || 0} вложенных папок и ${
            summary.files || 0
          } файлов. Все файлы будут безвозвратно удалены из MinIO.`,
          okText: 'Удалить папку',
          okButtonProps: { danger: true },
          cancelText: 'Отмена',
          onOk: async () => {
            await api.deleteFolder(folder.id, requestScope?.draftToken);
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
    return <Alert type="info" showIcon message="Сначала сохраните поставку, чтобы открыть документы." />;
  }

  return (
    <div className={blockClass} style={themeStyle}>
      <div className="process-documents-shell">
        {error ? <Alert type="warning" showIcon message={error} /> : null}
        {processTarget.status === 'new' ? (
          <Alert type="info" showIcon message="Документы будут прикреплены к поставке после сохранения формы." />
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
            {...directoryInputProps}
            ref={folderInputRef}
            type="file"
            multiple
            hidden
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

        <DocumentsList
          loading={loading}
          folders={folders}
          files={files}
          folderId={folderId}
          breadcrumbs={breadcrumbs}
          canDelete={canDelete}
          setFolderId={setFolderId}
          deleteFolder={deleteFolder}
          deleteFile={deleteFile}
          downloadFile={downloadFile}
        />
      </div>
    </div>
  );
}

export const ProcessDocumentsBlock = observer(ProcessDocumentsBlockComponent);
