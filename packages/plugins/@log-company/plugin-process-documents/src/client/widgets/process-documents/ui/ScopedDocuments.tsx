/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DownOutlined, LockOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { useAPIClient } from '@nocobase/client';
import { Alert, Button, Dropdown, Input, Modal, message, theme as antdTheme } from 'antd';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ProcessDocumentsApi,
  useDocumentsList,
  getDocumentErrorText as getErrorText,
} from '../../../entities/process-document';
import type {
  DocumentFolderDto as FolderItem,
  ProcessDocumentDto as FileItem,
  DocumentRequestScope,
} from '../../../entities/process-document';
import { blockClass } from './styles';
import { DocumentsList } from './DocumentsList';
import { DocumentFolderAccessDialog } from './DocumentFolderAccessDialog';
import { DocumentPreviewDialog, downloadDocument } from './DocumentPreviewDialog';

type ProcessResourceKey = string | number;

const directoryInputProps: React.InputHTMLAttributes<HTMLInputElement> & { webkitdirectory: string } = {
  webkitdirectory: '',
};

export function ScopedDocuments({
  requestScope,
  title = 'Документы',
  rootFolderId = null,
  readOnly = false,
  children,
  hasPendingDraft = false,
}: {
  requestScope: DocumentRequestScope | null;
  title?: string;
  rootFolderId?: ProcessResourceKey | null;
  readOnly?: boolean;
  children?: React.ReactNode;
  hasPendingDraft?: boolean;
}) {
  const apiClient = useAPIClient();
  const api = useMemo(() => new ProcessDocumentsApi(apiClient), [apiClient]);
  const { token } = antdTheme.useToken();
  const [uploading, setUploading] = useState(false);
  const [accessFolder, setAccessFolder] = useState<FolderItem>();
  const [preview, setPreview] = useState<FileItem>();
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

  const {
    permissions,
    currentFolder,
    breadcrumbs,
    folders,
    files,
    canWrite: effectiveCanWrite,
    canDelete,
    loading,
    error,
    forbidden,
    folderId,
    setFolderId,
    load,
  } = useDocumentsList(api, requestScope, rootFolderId);

  const canManageAccess = !readOnly && !error && permissions.canManageAccess;

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

  const loadFile = useCallback(
    async (file: FileItem, signal?: AbortSignal): Promise<Blob> => {
      const response = await apiClient.request<Blob>({
        url: 'processDocuments:download',
        method: 'get',
        params: { documentId: file.id, draftToken: requestScope?.draftToken },
        responseType: 'blob',
        signal,
      });
      return response.data;
    },
    [apiClient, requestScope?.draftToken],
  );
  const previewTarget = useMemo(
    () => preview && { name: preview.title, load: (signal?: AbortSignal) => loadFile(preview, signal) },
    [preview, loadFile],
  );
  const downloadFile = useCallback(
    async (file: FileItem) => {
      try {
        downloadDocument(await loadFile(file), file.title);
      } catch (error) {
        message.error(getErrorText(error, 'Не удалось скачать документ.'));
      }
    },
    [loadFile],
  );

  function createFolder() {
    if (!requestScope || readOnly) return;
    let name = '';
    Modal.confirm({
      title: 'Новая папка',
      content: (
        <Input
          aria-label="Название папки"
          autoFocus
          maxLength={200}
          onChange={(event) => {
            name = event.target.value;
          }}
        />
      ),
      okText: 'Создать',
      cancelText: 'Отмена',
      onOk: async () => {
        if (!name.trim()) {
          message.warning('Укажите название папки.');
          throw new Error('Пустое название папки');
        }
        await api.createFolder(requestScope, folderId, name);
        await load();
      },
    });
  }

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

  if (forbidden) return null;
  const isCustoms =
    requestScope && ('shipmentId' in requestScope || 'runId' in requestScope || requestScope.draftToken);
  const uploadDenied = isCustoms && !readOnly && !loading && !error && !effectiveCanWrite;
  return (
    <div className={blockClass} style={themeStyle}>
      <div className="process-documents-shell">
        {error ? <Alert type="warning" showIcon message={error} /> : null}
        {uploadDenied && <Alert type="info" showIcon message="У вас нет права загружать документы в разделе ВЭД." />}
        {hasPendingDraft ? (
          <Alert type="info" showIcon message="Документы будут прикреплены к поставке после сохранения формы." />
        ) : null}
        <div className="process-documents-toolbar">
          {effectiveCanWrite && !readOnly ? (
            <Dropdown menu={uploadMenu} trigger={['click']}>
              <Button icon={<UploadOutlined />} loading={uploading}>
                Загрузить <DownOutlined />
              </Button>
            </Dropdown>
          ) : uploadDenied ? (
            <Button icon={<UploadOutlined />} disabled>
              Загрузить
            </Button>
          ) : null}
          {effectiveCanWrite && !readOnly ? <Button onClick={createFolder}>Новая папка</Button> : null}
          {canManageAccess && currentFolder ? (
            <Button icon={<LockOutlined />} onClick={() => setAccessFolder(currentFolder)}>
              Доступ к папке
            </Button>
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
            {title}
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

        {folderId === rootFolderId ? children : null}
        <DocumentsList
          loading={loading}
          folders={folders}
          files={files}
          folderId={folderId === rootFolderId ? null : folderId}
          breadcrumbs={breadcrumbs}
          canDelete={canDelete && !readOnly}
          editAccess={canManageAccess ? setAccessFolder : undefined}
          setFolderId={setFolderId}
          deleteFolder={deleteFolder}
          deleteFile={deleteFile}
          downloadFile={downloadFile}
          previewFile={setPreview}
        />
        {previewTarget && <DocumentPreviewDialog file={previewTarget} onClose={() => setPreview(undefined)} />}
        {canManageAccess && accessFolder ? (
          <DocumentFolderAccessDialog
            folder={accessFolder}
            onClose={() => setAccessFolder(undefined)}
            onSave={async (grants) => {
              await api.setFolderAccess(accessFolder.id, grants);
              setAccessFolder(undefined);
              await load();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
