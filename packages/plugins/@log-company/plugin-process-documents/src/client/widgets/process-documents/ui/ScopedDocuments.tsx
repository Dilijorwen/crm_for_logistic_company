/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { LockOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAPIClient } from '@nocobase/client';
import { createPortal } from 'react-dom';
import { Alert, Button, Modal, Typography, message } from 'antd';
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
import {
  DocumentBrowser,
  DocumentUploadMenu,
  openDocumentFolderDialog,
  openDocumentRenameDialog,
} from './DocumentBrowser';
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
  uploadInsideFoldersOnly = false,
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
  uploadInsideFoldersOnly?: boolean;
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
  } = useDocumentsList(api, requestScope, rootFolderId, catalog?.initialFolderId ?? rootFolderId);

  const canManageAccess = (catalog?.manageAccess ?? !readOnly) && !error && permissions.canManageAccess;
  const canRename = !readOnly && !error && !loading && permissions.canRename;
  const compact = !!catalog;
  const isVirtual = emptyTrail.length > 0;
  const atRoot = folderId === rootFolderId && !isVirtual;
  const canWriteAtLocation = !uploadInsideFoldersOnly || !atRoot;
  const supportsDraftDestination =
    requestScope && (requestScope.shipmentId != null || ('runId' in requestScope && requestScope.runId != null));
  const canDrop =
    !readOnly &&
    allowUpload &&
    !loading &&
    effectiveCanWrite &&
    (!isVirtual || !virtualFolderWrite || virtualFolderWrite[emptyTrail[emptyTrail.length - 1]] === true);
  const canUpload = canDrop && canWriteAtLocation;
  const destinationKey = JSON.stringify([requestScope, folderId, emptyTrail]);
  const activeDestination = useRef(destinationKey);
  activeDestination.current = destinationKey;

  const reportFolder = catalog?.onFolderLocationChange;
  const reportChange = catalog?.onDocumentsChanged;
  useEffect(
    () => reportFolder?.(folderId == null ? undefined : String(folderId), isVirtual),
    [reportFolder, folderId, isVirtual],
  );
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
      targetFolderId?: FolderItem['id'],
    ) => {
      if (!requestScope || !canDrop || (targetFolderId == null && !canWriteAtLocation) || pendingUpload.current) return;
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
          : targetFolderId ?? folderId;
        await api.uploadSelected(requestScope, destination, files, emptyFolders);
        reportChange?.();
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
    [
      api,
      canDrop,
      canWriteAtLocation,
      destinationKey,
      emptyTrail,
      folderId,
      load,
      reportChange,
      requestScope,
      setFolderId,
    ],
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
    openDocumentFolderDialog(modal, async (name) => {
      const destination = await api.ensureRequestFolder(requestScope, folderId, emptyTrail);
      await api.createFolder(requestScope, destination, name);
      reportChange?.();
      if (emptyTrail.length) {
        setEmptyTrail([]);
        setFolderId(destination);
      } else await load();
    });
  }

  function renameEntry(kind: 'file' | 'folder', item: FolderItem | FileItem) {
    const original = 'original_filename' in item ? item.original_filename : undefined;
    openDocumentRenameDialog(modal, kind, item.title, original, async (name) => {
      try {
        await api.renameEntry(kind, item.id, name, requestScope?.draftToken);
        reportChange?.();
        if (kind === 'file') setPreview(undefined);
        await load();
      } catch (reason) {
        message.error(getErrorText(reason, 'Не удалось сохранить имя.'));
        throw reason;
      }
    });
  }

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
          reportChange?.();
          await load();
        },
      });
    },
    [api, load, modal, reportChange, requestScope],
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
            reportChange?.();
            await load();
          },
        });
      } catch (err) {
        message.error(getErrorText(err, 'Не удалось подготовить удаление папки'));
      }
    },
    [api, load, modal, reportChange, requestScope],
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
  const isSavedCustoms =
    requestScope?.shipmentId != null ||
    (requestScope !== null && 'runId' in requestScope && requestScope.runId != null);
  const canDeleteEntries = canDelete && (isSavedCustoms || !readOnly);
  const uploadDenied =
    (isSavedCustoms || requestScope?.draftToken) &&
    canWriteAtLocation &&
    !readOnly &&
    !loading &&
    !error &&
    !effectiveCanWrite;
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
    : showRefresh ||
      (allowUpload && canWriteAtLocation && !readOnly) ||
      (currentFolder && (canManageAccess || canRename));
  const toolbar = hasToolbar && (
    <div
      className="process-documents-toolbar"
      style={
        catalog?.toolbarTarget
          ? { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }
          : undefined
      }
    >
      {(canUpload || (allowUpload && uploadDenied)) && (
        <DocumentUploadMenu
          busy={uploading}
          disabled={!canUpload}
          fileInput={fileInputRef}
          folderInput={folderInputRef}
          createFolder={canUpload ? createFolder : undefined}
        />
      )}
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
      {allowUpload && canWriteAtLocation && !readOnly && (
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
    <DocumentBrowser title={titleAsHeading ? rootLabel : undefined}>
      {modalHolder}
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
        allowDropAtCurrentFolder={canWriteAtLocation}
        onDrop={
          canDrop && !uploading
            ? (transfer, folder) => uploadSelection(() => readDroppedDocuments(transfer), folder?.id)
            : undefined
        }
        {...(supportsDraftDestination && {
          draftFolderId: folderId,
          allowDraftDrop: !readOnly && !loading && effectiveCanWrite,
        })}
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
          deleteFolder: canDeleteEntries ? deleteFolder : undefined,
        }}
        deleteFile={canDeleteEntries ? deleteFile : undefined}
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
          key={String(accessFolder.id)}
          folder={accessFolder}
          api={api}
          companyId={requestScope && 'runId' in requestScope && requestScope.runId ? requestScope.companyId : undefined}
          path={accessPath}
          onClose={() => setAccessFolder(undefined)}
          onSave={async (grants) => {
            if (requestScope && accessFolder.id === `virtual-folder:${companyRequestFolderTypes.our_companies}`) {
              const parent = await api.ensureRequestFolder(requestScope, folderId, emptyTrail);
              const id = await api.ensureRequestFolder(requestScope, parent, [companyRequestFolderTypes.our_companies]);
              if (id === null) throw new Error('Папка не найдена.');
              await api.setFolderAccess(id, grants);
              reportChange?.();
              setEmptyTrail([]);
              if (emptyTrail.length) setFolderId(parent);
              else await load();
            } else {
              await api.setFolderAccess(accessFolder.id, grants);
              reportChange?.();
              await load();
            }
            setAccessFolder(undefined);
          }}
        />
      ) : null}
    </DocumentBrowser>
  );
}
