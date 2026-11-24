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
import { createPortal } from 'react-dom';
import { Alert, Button, Dropdown, Input, Modal, Typography, message } from 'antd';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ProcessDocumentsApi,
  useDocumentsList,
  getDocumentErrorText as getErrorText,
} from '../../../entities/process-document';
import type {
  DocumentFolderDto as FolderItem,
  ProcessDocumentDto as FileItem,
  DocumentRequestScope,
  SelectedDocument,
} from '../../../entities/process-document';
import { blockClass, useDocumentsTheme } from './styles';
import { DocumentsList } from './DocumentsList';
import { DocumentFolderAccessDialog } from './DocumentFolderAccessDialog';
import { DocumentPreviewDialog, downloadDocument } from './DocumentPreviewDialog';
import { readDroppedDocuments } from '../model/droppedDocuments';
import { DocumentCatalogContext } from './DocumentCatalogContext';
import { companyRequestFolderTitle, companyRequestFolderTypes } from '../../../../contracts/processDocuments';
import type { CompanyRequestFolderName } from '../../../../contracts/processDocuments';
import { isCompanyRequestFolder } from '../../../../contracts/processDocuments';

type ProcessResourceKey = string | number;

const directoryInputProps: React.InputHTMLAttributes<HTMLInputElement> & { webkitdirectory: string } = {
  webkitdirectory: '',
};

export function ScopedDocuments({
  requestScope,
  title,
  titleAsHeading = false,
  rootFolderId = null,
  readOnly = false,
  allowUpload = true,
  showRefresh = true,
  showRequestFolders = false,
  extraFolders = [],
  children,
  hasPendingDraft = false,
  fixedFolderMessage = false,
}: {
  requestScope: DocumentRequestScope | null;
  title?: string;
  titleAsHeading?: boolean;
  rootFolderId?: ProcessResourceKey | null;
  readOnly?: boolean;
  allowUpload?: boolean;
  showRefresh?: boolean;
  showRequestFolders?: boolean;
  extraFolders?: Array<{ id: string; title: string; open(): void }>;
  children?: React.ReactNode;
  hasPendingDraft?: boolean;
  fixedFolderMessage?: boolean;
}) {
  const apiClient = useAPIClient();
  const catalog = useContext(DocumentCatalogContext);
  const [modal, modalHolder] = Modal.useModal();
  const api = useMemo(() => new ProcessDocumentsApi(apiClient), [apiClient]);
  const themeStyle = useDocumentsTheme();
  const [uploading, setUploading] = useState(false);
  const [accessFolder, setAccessFolder] = useState<FolderItem>();
  const [preview, setPreview] = useState<FileItem>();
  const [emptyTrail, setEmptyTrail] = useState<CompanyRequestFolderName[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const pendingUpload = useRef(false);

  const {
    permissions,
    currentFolder,
    breadcrumbs,
    folders,
    files,
    emptyRequestFolders,
    virtualFolderWrite,
    canWrite: effectiveCanWrite,
    canDelete,
    loading,
    error,
    forbidden,
    folderId,
    rootTitle,
    setFolderId,
    load,
  } = useDocumentsList(api, requestScope, rootFolderId);

  const canManageAccess = (catalog?.manageAccess ?? !readOnly) && !error && permissions.canManageAccess;
  const canRename = !readOnly && !error && !loading && permissions.canRename;
  const compact = !!catalog;
  const isVirtual = emptyTrail.length > 0;
  const atRoot = folderId === rootFolderId && !isVirtual;
  const canUpload =
    !readOnly &&
    allowUpload &&
    !loading &&
    effectiveCanWrite &&
    (!isVirtual || !virtualFolderWrite || virtualFolderWrite[emptyTrail[emptyTrail.length - 1]] === true);
  const destinationKey = JSON.stringify([requestScope, folderId, emptyTrail]);
  const activeDestination = useRef(destinationKey);
  activeDestination.current = destinationKey;

  const onFolderLocationChange = showRequestFolders ? catalog?.onCompanyFolderLocationChange : undefined;
  useEffect(() => onFolderLocationChange?.(atRoot), [atRoot, onFolderLocationChange]);

  const uploadSelection = useCallback(
    async (
      getSelection: () =>
        | {
            files: readonly SelectedDocument[];
            emptyFolders?: readonly string[];
          }
        | Promise<{ files: readonly SelectedDocument[]; emptyFolders?: readonly string[] }>,
    ) => {
      if (!requestScope || !canUpload || pendingUpload.current) return;
      pendingUpload.current = true;
      setUploading(true);
      try {
        const selection = getSelection();
        const { files, emptyFolders } = selection instanceof Promise ? await selection : selection;
        if (!files.length && !emptyFolders?.length) {
          message.info('В выбранных папках нет файлов.');
          return;
        }
        const destination = emptyTrail.length
          ? await api.ensureRequestFolder(requestScope, folderId, emptyTrail)
          : folderId;
        await api.uploadSelected(requestScope, destination, files, emptyFolders);
        if (activeDestination.current !== destinationKey) return;
        if (emptyTrail.length) {
          setEmptyTrail([]);
          setFolderId(destination);
        } else await load();
      } catch (err) {
        message.error(getErrorText(err, 'Не удалось загрузить файлы'));
      } finally {
        pendingUpload.current = false;
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        if (folderInputRef.current) {
          folderInputRef.current.value = '';
        }
      }
    },
    [api, canUpload, destinationKey, emptyTrail, folderId, load, requestScope, setFolderId],
  );

  function uploadFiles(selected: FileList | null) {
    if (!selected?.length) return;
    return uploadSelection(() => ({
      files: Array.from(selected, (file) => ({ file, name: file.webkitRelativePath || file.name })),
    }));
  }

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
    if (!requestScope || !canUpload) return;
    let name = '';
    modal.confirm({
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
        const destination = await api.ensureRequestFolder(requestScope, folderId, emptyTrail);
        await api.createFolder(requestScope, destination, name);
        if (emptyTrail.length) {
          setEmptyTrail([]);
          setFolderId(destination);
        } else await load();
      },
    });
  }

  function renameEntry(kind: 'file' | 'folder', item: FolderItem | FileItem) {
    const original = 'original_filename' in item ? item.original_filename : undefined;
    const dot = original?.lastIndexOf('.') ?? -1;
    const suffix = dot > 0 ? original?.slice(dot) ?? '' : '';
    let name = suffix && item.title.endsWith(suffix) ? item.title.slice(0, -suffix.length) : item.title;
    modal.confirm({
      title: kind === 'file' ? 'Переименовать файл' : 'Переименовать папку',
      content: (
        <Input
          aria-label="Новое имя"
          defaultValue={name}
          addonAfter={suffix || undefined}
          autoFocus
          maxLength={200 - suffix.length}
          onChange={(event) => {
            name = event.target.value;
          }}
        />
      ),
      okText: 'Сохранить',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await api.renameEntry(kind, item.id, name, requestScope?.draftToken);
          if (kind === 'file') setPreview(undefined);
          await load();
        } catch (reason) {
          message.error(getErrorText(reason, 'Не удалось сохранить имя.'));
          throw reason;
        }
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
      modal.confirm({
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
    [api, load, modal, requestScope],
  );

  const deleteFolder = useCallback(
    async (folder: FolderItem) => {
      try {
        const summary = await api.folderDeleteSummary(folder.id, requestScope?.draftToken);
        modal.confirm({
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
    [api, load, modal, requestScope],
  );

  if (forbidden)
    return fixedFolderMessage ? <Alert type="info" showIcon message="Нет доступа к выбранной папке." /> : null;
  const virtualChildren =
    emptyTrail.at(-1) === companyRequestFolderTitle &&
    (!virtualFolderWrite || virtualFolderWrite[companyRequestFolderTypes.our_companies] !== undefined)
      ? [companyRequestFolderTypes.our_companies]
      : [];
  const virtualNames = isVirtual
    ? virtualChildren
    : showRequestFolders && !loading && !error
      ? emptyRequestFolders ?? []
      : [];
  const isCustoms =
    requestScope && ('shipmentId' in requestScope || 'runId' in requestScope || requestScope.draftToken);
  const uploadDenied = isCustoms && !readOnly && !loading && !error && !effectiveCanWrite;
  const rootLabel = title ?? rootTitle ?? 'Документы';
  const isCompanyFolder = requestScope && 'companyArea' in requestScope && requestScope.companyArea === 'company';
  const isManagedFolder =
    isCompanyFolder &&
    ((breadcrumbs.length === 1 && currentFolder && isCompanyRequestFolder(currentFolder.title)) ||
      (breadcrumbs.length === 2 &&
        isCompanyRequestFolder(breadcrumbs[0].title) &&
        Object.values(companyRequestFolderTypes).some((type) => type === currentFolder?.title)));
  const accessPath =
    accessFolder &&
    [
      ...(catalog?.path ?? [rootLabel]),
      ...breadcrumbs.map(({ title }) => title),
      ...(String(accessFolder.id) === String(folderId) ? [] : [accessFolder.title]),
    ].join(' / ');
  const hasToolbar = compact
    ? canUpload || (allowUpload && uploadDenied)
    : showRefresh || (allowUpload && !readOnly) || (currentFolder && (canManageAccess || canRename));
  const toolbar = hasToolbar && (
    <div
      className="process-documents-toolbar"
      style={
        catalog?.toolbarTarget
          ? { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }
          : undefined
      }
    >
      {canUpload ? (
        <Dropdown menu={uploadMenu} trigger={['click']}>
          <Button icon={<UploadOutlined />} loading={uploading}>
            Загрузить <DownOutlined />
          </Button>
        </Dropdown>
      ) : allowUpload && uploadDenied ? (
        <Button icon={<UploadOutlined />} disabled>
          Загрузить
        </Button>
      ) : null}
      {canUpload ? <Button onClick={createFolder}>Новая папка</Button> : null}
      {!compact && canRename && currentFolder && !isManagedFolder && !isVirtual && (
        <Button onClick={() => renameEntry('folder', currentFolder)}>Переименовать папку</Button>
      )}
      {!compact && canManageAccess && currentFolder && !isVirtual ? (
        <Button icon={<LockOutlined />} onClick={() => setAccessFolder(currentFolder)}>
          Доступ к папке
        </Button>
      ) : null}
      {!compact && showRefresh && (
        <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>
          Обновить
        </Button>
      )}
      {allowUpload && !readOnly && (
        <>
          <input ref={fileInputRef} type="file" multiple hidden onChange={(event) => uploadFiles(event.target.files)} />
          <input
            {...directoryInputProps}
            ref={folderInputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => uploadFiles(event.target.files)}
          />
        </>
      )}
    </div>
  );
  return (
    <div className={`${blockClass} process-documents-scroll`} style={themeStyle}>
      {modalHolder}
      <div className="process-documents-shell">
        {titleAsHeading && (
          <Typography.Title level={5} style={{ margin: 0 }}>
            {rootLabel}
          </Typography.Title>
        )}
        {error ? <Alert type="warning" showIcon message={error} /> : null}
        {uploadDenied && <Alert type="info" showIcon message="У вас нет права загружать документы в разделе ВЭД." />}
        {hasPendingDraft ? (
          <Alert type="info" showIcon message="Документы будут прикреплены к поставке после сохранения формы." />
        ) : null}
        {catalog?.toolbarTarget ? createPortal(toolbar, catalog.toolbarTarget) : toolbar}

        {(folderId !== rootFolderId || isVirtual) && (
          <div className="process-documents-breadcrumbs">
            <Button
              type="link"
              className="process-documents-crumb"
              onClick={() => {
                setEmptyTrail([]);
                setFolderId(null);
              }}
            >
              {titleAsHeading ? 'К списку файлов' : rootLabel}
            </Button>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={String(crumb.id)}>
                <span>/</span>
                {index === breadcrumbs.length - 1 && !isVirtual ? (
                  <Typography.Text strong>{crumb.title}</Typography.Text>
                ) : (
                  <Button
                    type="link"
                    className="process-documents-crumb"
                    onClick={() => {
                      setEmptyTrail([]);
                      setFolderId(crumb.id);
                    }}
                  >
                    {crumb.title}
                  </Button>
                )}
              </React.Fragment>
            ))}
            {emptyTrail.map((name, index) => (
              <React.Fragment key={name}>
                <span>/</span>
                {index === emptyTrail.length - 1 ? (
                  <Typography.Text strong>{name}</Typography.Text>
                ) : (
                  <Button
                    type="link"
                    className="process-documents-crumb"
                    onClick={() => setEmptyTrail(emptyTrail.slice(0, index + 1))}
                  >
                    {name}
                  </Button>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {!isVirtual && folderId === rootFolderId ? children : null}
        <DocumentsList
          compactActions={compact}
          onDrop={
            compact && canUpload && !uploading
              ? (transfer) => uploadSelection(() => readDroppedDocuments(transfer))
              : undefined
          }
          loading={loading}
          files={isVirtual ? [] : files}
          extraFolders={[
            ...(!isVirtual && folderId === rootFolderId ? extraFolders : []),
            ...virtualNames.map((name) => ({
              id: `virtual-folder:${name}`,
              title: name,
              open: () => setEmptyTrail((previous) => [...previous, name]),
              ...(compact &&
                canManageAccess &&
                name === companyRequestFolderTypes.our_companies && {
                  editAccess: () => setAccessFolder({ id: `virtual-folder:${name}`, title: name }),
                }),
            })),
          ]}
          hasOtherEntries={!isVirtual && !!(children && folderId === rootFolderId)}
          folderNavigation={{
            folders: isVirtual ? [] : folders,
            folderId: isVirtual || folderId === rootFolderId ? null : folderId,
            breadcrumbs,
            editAccess: canManageAccess ? setAccessFolder : undefined,
            setFolderId,
            renameFolder: canRename ? (folder) => renameEntry('folder', folder) : undefined,
            deleteFolder: canDelete && !readOnly ? deleteFolder : undefined,
          }}
          deleteFile={canDelete && !readOnly ? deleteFile : undefined}
          downloadFile={downloadFile}
          previewFile={setPreview}
          renameFile={canRename ? (file) => renameEntry('file', file) : undefined}
        />
        {previewTarget && (
          <DocumentPreviewDialog
            file={previewTarget}
            onClose={() => setPreview(undefined)}
            onRename={!compact && canRename && preview ? () => renameEntry('file', preview) : undefined}
          />
        )}
        {canManageAccess && accessFolder ? (
          <DocumentFolderAccessDialog
            folder={accessFolder}
            path={accessPath}
            onClose={() => setAccessFolder(undefined)}
            onSave={async (grants) => {
              if (requestScope && accessFolder.id === `virtual-folder:${companyRequestFolderTypes.our_companies}`) {
                const parent = await api.ensureRequestFolder(requestScope, folderId, emptyTrail);
                const id = await api.ensureRequestFolder(requestScope, parent, [
                  companyRequestFolderTypes.our_companies,
                ]);
                if (id === null) throw new Error('Папка не найдена.');
                await api.setFolderAccess(id, grants);
                setEmptyTrail([]);
                if (emptyTrail.length) setFolderId(parent);
                else await load();
              } else {
                await api.setFolderAccess(accessFolder.id, grants);
                await load();
              }
              setAccessFolder(undefined);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
