/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import {
  DeleteOutlined,
  DownloadOutlined,
  FileOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { Button, Empty, Spin, Tooltip } from 'antd';
import dayjs from 'dayjs';
import type {
  DocumentFolderDto as FolderItem,
  ProcessDocumentDto as FileItem,
  DocumentsListResponse,
} from '../../../entities/process-document';

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

interface DocumentsListProps {
  loading: boolean;
  folders: FolderItem[];
  files: FileItem[];
  folderId: string | number | null;
  breadcrumbs: DocumentsListResponse['breadcrumbs'];
  canDelete: boolean;
  setFolderId: (id: string | number | null) => void;
  deleteFolder: (folder: FolderItem) => Promise<void>;
  deleteFile: (file: FileItem) => void;
  downloadFile: (file: FileItem) => void;
}

export function DocumentsList({
  loading,
  folders,
  files,
  folderId,
  breadcrumbs,
  canDelete,
  setFolderId,
  deleteFolder,
  deleteFile,
  downloadFile,
}: DocumentsListProps) {
  return (
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
  );
}
