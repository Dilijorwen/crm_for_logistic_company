/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { createContext, useContext, useState } from 'react';
import {
  DeleteOutlined,
  DownloadOutlined,
  FileOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  LoadingOutlined,
  LockOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Empty, Spin, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import dayjs from 'dayjs';
import type {
  DocumentFolderDto as FolderItem,
  ProcessDocumentDto,
  DocumentsListResponse,
} from '../../../entities/process-document';
import { blockClass, useDocumentsTheme } from './styles';
import { DocumentActionsButton } from './DocumentActionsButton';

export const FormDocumentListContext = createContext<{
  controls: React.ReactNode;
  hasDraftFiles: boolean;
  onDrop?: (transfer: DataTransfer, folderId?: FolderItem['id'] | null) => Promise<void>;
} | null>(null);

export function EmptyFormDocumentList() {
  const style = useDocumentsTheme();
  return (
    <div className={blockClass} style={style}>
      <DocumentsList files={[]} />
    </div>
  );
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

function formatDate(value?: string | null) {
  return value ? dayjs(value).format('DD.MM.YYYY HH:mm') : '';
}

interface DocumentsListProps<FileItem extends ProcessDocumentDto> {
  loading?: boolean;
  files: FileItem[];
  folderNavigation?: {
    folders: FolderItem[];
    folderId: string | number | null;
    breadcrumbs: DocumentsListResponse['breadcrumbs'];
    editAccess?: (folder: FolderItem) => void;
    setFolderId: (id: string | number | null) => void;
    deleteFolder?: (folder: FolderItem) => Promise<void>;
    renameFolder?: (folder: FolderItem) => void;
  };
  deleteFile?: (file: FileItem) => void;
  deleteDisabled?: boolean;
  downloadFile?: (file: FileItem) => void;
  previewFile?: (file: FileItem) => void;
  renameFile?: (file: FileItem) => void;
  compactActions?: boolean;
  onDrop?: (transfer: DataTransfer, folder?: FolderItem) => Promise<void>;
  draftFolderId?: FolderItem['id'] | null;
  allowDraftDrop?: boolean;
  hasOtherEntries?: boolean;
  extraFolders?: Array<{ id: string; title: string; open(): void; editAccess?(): void }>;
  showParentRow?: boolean;
  emptyDescription?: string;
  fileLocations?: {
    label: (file: FileItem) => string;
    open: (file: FileItem) => void;
  };
  fileKey?: (file: FileItem) => string;
}

export function DocumentsList<FileItem extends ProcessDocumentDto>({
  loading,
  files,
  folderNavigation,
  deleteFile,
  deleteDisabled,
  downloadFile,
  previewFile,
  renameFile,
  compactActions = false,
  onDrop,
  draftFolderId,
  allowDraftDrop = true,
  hasOtherEntries,
  extraFolders = [],
  showParentRow = false,
  emptyDescription = 'Папка пуста',
  fileLocations,
  fileKey,
}: DocumentsListProps<FileItem>) {
  const folders = folderNavigation?.folders ?? [];
  const { folderId, breadcrumbs, editAccess, setFolderId, deleteFolder, renameFolder } = folderNavigation ?? {};
  const rows: { folder: FolderItem; open(): void; system: boolean; editAccess?(): void }[] = [
    ...extraFolders.map((folder) => ({ folder, open: folder.open, system: true, editAccess: folder.editAccess })),
    ...folders.map((folder) => ({ folder, open: () => setFolderId?.(folder.id), system: false })),
  ];
  const draft = useContext(FormDocumentListContext);
  const [isDragging, setDragging] = useState(false);
  const [dropRow, setDropRow] = useState<string>();
  const draftDrop = allowDraftDrop ? draft?.onDrop : undefined;
  const handleDrop = onDrop ?? (draftDrop && ((transfer, folder) => draftDrop(transfer, folder?.id ?? draftFolderId)));

  function destination(target: EventTarget): FolderItem | null | undefined {
    const row = target instanceof Element ? target.closest<HTMLElement>('[data-document-drop-row]') : null;
    if (!row) return undefined;
    if (!onDrop && draftFolderId === undefined) return undefined;
    const entry = rows[Number(row.dataset.documentDropRow)];
    return entry && !entry.system && entry.folder.canWrite !== false ? entry.folder : null;
  }

  function withActions(
    key: string,
    title: string,
    items: MenuProps['items'],
    cells: React.ReactNode,
    inlineActions?: React.ReactNode,
    folderIndex?: number,
  ) {
    const menu: MenuProps = { items };
    const hasMenu = !inlineActions && !!items?.length;
    const row = (
      <div
        key={key}
        className={`process-documents-row${dropRow === key ? ' process-documents-row-drop-target' : ''}`}
        data-document-drop-row={folderIndex}
      >
        {cells}
        <span className="process-documents-actions">
          {hasMenu ? <DocumentActionsButton menu={menu} label={`Действия: ${title}`} /> : inlineActions}
        </span>
      </div>
    );
    return hasMenu ? (
      <Dropdown key={key} menu={menu} trigger={['contextMenu']}>
        {row}
      </Dropdown>
    ) : (
      row
    );
  }

  return (
    <section
      className={`process-documents-list${fileLocations ? ' process-documents-list-search' : ''}${
        isDragging ? ' process-documents-list-dragging' : ''
      }`}
      aria-label="Список документов"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        event.stopPropagation();
        const folder = destination(event.target);
        const allowed = !!handleDrop && folder !== null;
        event.dataTransfer.dropEffect = allowed ? 'copy' : 'none';
        setDragging(allowed && folder === undefined);
        setDropRow(allowed && folder ? `folder-${folder.id}` : undefined);
      }}
      onDragLeave={
        isDragging || dropRow
          ? (event) => {
              if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
                setDragging(false);
                setDropRow(undefined);
              }
            }
          : undefined
      }
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes('Files') && !event.dataTransfer.files.length) return;
        event.preventDefault();
        event.stopPropagation();
        setDragging(false);
        setDropRow(undefined);
        const folder = destination(event.target);
        if (folder !== null) return handleDrop?.(event.dataTransfer, folder);
      }}
    >
      {draft && <div className="process-documents-form-controls">{draft.controls}</div>}
      {loading && !rows.length && !files.length ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
          <Spin indicator={<LoadingOutlined spin />} />
        </div>
      ) : null}
      {rows.length || files.length ? (
        <div className="process-documents-row process-documents-columns" aria-hidden="true">
          <span>Имя</span>
          {fileLocations && <span>Папка</span>}
          <span className="process-documents-meta">Тип</span>
          <span className="process-documents-meta">Размер</span>
          <span className="process-documents-meta">Дата создания</span>
          <span className="process-documents-meta">Кто создал</span>
          <span />
        </div>
      ) : null}
      {!loading && !rows.length && !files.length && !draft?.hasDraftFiles && !hasOtherEntries ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} />
      ) : null}
      {showParentRow && folderId && (
        <div className="process-documents-row">
          <button
            type="button"
            className="process-documents-name"
            onClick={() => setFolderId?.(breadcrumbs?.at(-2)?.id ?? null)}
          >
            <FolderOpenOutlined aria-hidden="true" />
            <span>..</span>
          </button>
        </div>
      )}
      {rows.map(({ folder, system, open, editAccess: editVirtualAccess }, index) => {
        const items: MenuProps['items'] = [];
        if (!system && renameFolder && folder.canRename !== false)
          items.push({
            key: 'rename',
            label: 'Переименовать',
            icon: <EditOutlined aria-hidden="true" />,
            onClick: () => renameFolder(folder),
          });
        if (!system && editAccess)
          items.push({
            key: 'access',
            label: 'Права папки',
            icon: <LockOutlined aria-hidden="true" />,
            onClick: () => editAccess(folder),
          });
        if (editVirtualAccess)
          items.push({
            key: 'access',
            label: 'Права папки',
            icon: <LockOutlined aria-hidden="true" />,
            onClick: editVirtualAccess,
          });
        if (!system && deleteFolder && folder.canDelete !== false)
          items.push({
            key: 'delete',
            label: 'Удалить',
            danger: true,
            icon: <DeleteOutlined aria-hidden="true" />,
            onClick: () => deleteFolder(folder),
          });
        return withActions(
          `folder-${folder.id}`,
          folder.title,
          items,
          <>
            <button type="button" className="process-documents-name" onClick={open}>
              <FolderOutlined aria-hidden="true" />
              <span className="process-documents-name-text" title={folder.title}>
                {folder.title}
              </span>
            </button>
            <span className="process-documents-meta">Папка</span>
            <span className="process-documents-meta">—</span>
            <span className="process-documents-meta">{formatDate(folder.createdAt) || '—'}</span>
            <span className="process-documents-meta">{system ? 'Система' : folder.author || '—'}</span>
          </>,
          compactActions ? undefined : (
            <>
              {editAccess && !system ? (
                <Tooltip title="Настроить доступ">
                  <Button
                    aria-label="Настроить доступ"
                    size="small"
                    icon={<LockOutlined />}
                    onClick={() => editAccess(folder)}
                  />
                </Tooltip>
              ) : null}
              {deleteFolder && !system && folder.canDelete !== false ? (
                <Tooltip title="Удалить папку">
                  <Button
                    aria-label={`Удалить папку «${folder.title}»`}
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => deleteFolder(folder)}
                  />
                </Tooltip>
              ) : null}
            </>
          ),
          index,
        );
      })}
      {files.map((file) => {
        const items: MenuProps['items'] = [];
        if (previewFile)
          items.push({
            key: 'preview',
            label: 'Открыть',
            icon: <FileOutlined aria-hidden="true" />,
            onClick: () => previewFile(file),
          });
        if (fileLocations)
          items.push({
            key: 'location',
            label: 'Перейти в папку',
            icon: <FolderOutlined aria-hidden="true" />,
            onClick: () => fileLocations.open(file),
          });
        if (downloadFile)
          items.push({
            key: 'download',
            label: 'Скачать',
            icon: <DownloadOutlined aria-hidden="true" />,
            onClick: () => downloadFile(file),
          });
        if (renameFile)
          items.push({
            key: 'rename',
            label: 'Переименовать',
            icon: <EditOutlined aria-hidden="true" />,
            onClick: () => renameFile(file),
          });
        if (deleteFile)
          items.push({
            key: 'delete',
            label: 'Удалить',
            danger: true,
            icon: <DeleteOutlined aria-hidden="true" />,
            disabled: deleteDisabled,
            onClick: () => deleteFile(file),
          });
        return withActions(
          `file-${fileKey?.(file) ?? file.id}`,
          file.title,
          items,
          <>
            <button type="button" className="process-documents-name" onClick={() => previewFile?.(file)}>
              <FileOutlined aria-hidden="true" />
              <span className="process-documents-name-text" title={file.title}>
                {file.title}
              </span>
            </button>
            {fileLocations && (
              <Button type="link" className="process-documents-file-location" onClick={() => fileLocations.open(file)}>
                {fileLocations.label(file)}
              </Button>
            )}
            <span className="process-documents-meta">
              {file.title.match(/\.([^./]+)$/)?.[1].toUpperCase() ?? 'Файл'}
            </span>
            <span className="process-documents-meta">{file.file_size == null ? '' : formatSize(file.file_size)}</span>
            <span className="process-documents-meta">{formatDate(file.createdAt)}</span>
            <span className="process-documents-meta">{file.author}</span>
          </>,
        );
      })}
    </section>
  );
}
