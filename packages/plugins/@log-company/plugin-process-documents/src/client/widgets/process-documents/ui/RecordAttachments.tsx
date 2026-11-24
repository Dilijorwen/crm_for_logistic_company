/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useAPIClient } from '@nocobase/client';
import { Alert, Button, Modal, Select, Space, Spin, message } from 'antd';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { RecordAttachmentsApi, getDocumentErrorText, isDocumentAccessDenied } from '../../../entities/process-document';
import type { CatalogId, RecordAttachment, RecordAttachmentField } from '../../../entities/process-document';
import { DocumentPreviewDialog, downloadDocument } from './DocumentPreviewDialog';
import { DocumentsList } from './DocumentsList';
import { DocumentCatalogContext } from './DocumentCatalogContext';
import { blockClass, useDocumentsTheme } from './styles';

interface RecordAttachmentsProps {
  recordId: string | number;
  collection: string;
  dataSourceKey: string;
  fields: RecordAttachmentField[];
  extraFolders?: Array<{ id: string; title: string; open(): void }>;
  readOnly?: boolean;
  canUpdateField?: (collection: string, field: string, dataSourceKey: string) => Promise<boolean>;
}

export function RecordAttachments({ fields, ...record }: RecordAttachmentsProps) {
  const [selected, setSelected] = useState<string>();
  const field =
    fields.find(({ name }) => name === selected) ??
    fields.find(({ name }) => name === 'documents') ??
    (fields.length === 1 ? fields[0] : undefined);
  if (!fields.length) {
    return <Alert type="info" showIcon message="В этой коллекции нет поля типа «Вложение»." />;
  }
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {fields.length > 1 && (
        <Select
          aria-label="Поле вложений"
          placeholder="Выберите поле вложений"
          value={field?.name}
          options={fields.map(({ name, title }) => ({ value: name, label: title }))}
          onChange={setSelected}
        />
      )}
      {field && <AttachmentFieldDocuments key={field.name} {...record} field={field} />}
    </Space>
  );
}

function AttachmentFieldDocuments({
  recordId,
  collection,
  dataSourceKey,
  field,
  extraFolders,
  canUpdateField,
  readOnly = false,
}: Omit<RecordAttachmentsProps, 'fields'> & { field: RecordAttachmentField }) {
  const catalog = useContext(DocumentCatalogContext);
  const client = useAPIClient();
  const themeStyle = useDocumentsTheme();
  const { name, multiple } = field;
  const api = useMemo(
    () => new RecordAttachmentsApi(client, collection, recordId, name, multiple, dataSourceKey),
    [client, collection, recordId, name, multiple, dataSourceKey],
  );
  const [result, setResult] = useState<{
    files: RecordAttachment[];
    canDelete?: boolean;
    hidden?: boolean;
  }>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [preview, setPreview] = useState<RecordAttachment>();
  const [deleting, setDeleting] = useState<RecordAttachment>();
  const [folderId, setFolderId] = useState<string | null>(null);
  const busyRef = useRef(false);
  useEffect(() => {
    let active = true;
    setError(undefined);
    setResult(undefined);
    async function load() {
      try {
        const files = await api.load();
        const fieldAccess =
          !files.hidden &&
          !readOnly &&
          !field.readOnly &&
          Boolean(await canUpdateField?.(collection, name, dataSourceKey));
        if (active)
          setResult({
            ...files,
            canDelete: (files.canDelete ?? files.canUpdate) && fieldAccess,
          });
      } catch (error) {
        if (!active) return;
        if (isDocumentAccessDenied(error)) setResult({ files: [], hidden: true });
        else setError(getDocumentErrorText(error, 'Не удалось загрузить список документов.'));
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [api, canUpdateField, collection, dataSourceKey, field.readOnly, name, readOnly, revision]);

  async function deleteFile() {
    if (!deleting || !result?.canDelete || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await api.deleteFile(deleting.id);
      setDeleting(undefined);
      setRevision((value) => value + 1);
    } catch (error) {
      message.error(getDocumentErrorText(error, 'Не удалось сохранить изменение.'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const previewTarget = useMemo(
    () => preview && { name: preview.title, load: (signal?: AbortSignal) => api.open(preview.id, signal) },
    [api, preview],
  );

  async function downloadFile(file: RecordAttachment) {
    try {
      downloadDocument(await api.open(file.id), file.title);
    } catch (error) {
      message.error(getDocumentErrorText(error, 'Не удалось скачать документ.'));
    }
  }

  if (error)
    return (
      <Alert
        type="error"
        showIcon
        message={error}
        action={<Button onClick={() => setRevision((value) => value + 1)}>Повторить</Button>}
      />
    );
  if (!result) return <Spin aria-label="Загрузка документов" />;
  if (result.hidden) return null;

  const directory = folderId?.split('/') ?? [];
  const folders = new Set<string>();
  const files = result.files.filter((file) => {
    const path = file.folders ?? [];
    if (!directory.every((name, index) => name === path[index])) return false;
    if (path.length === directory.length) return true;
    folders.add(path[directory.length]);
    return false;
  });
  const folderNavigation =
    folderId || folders.size
      ? {
          folderId,
          folders: [...folders]
            .sort((left, right) => left.localeCompare(right, 'ru'))
            .map((title) => ({
              id: [...directory, title].join('/'),
              title,
            })),
          breadcrumbs: directory.map((title, index) => ({ id: directory.slice(0, index + 1).join('/'), title })),
          setFolderId: (id: CatalogId | null) => setFolderId(id === null ? null : String(id)),
        }
      : undefined;

  return (
    <div className={blockClass} style={themeStyle}>
      <div className="process-documents-shell">
        <DocumentsList<RecordAttachment>
          files={files}
          compactActions={!!catalog}
          extraFolders={extraFolders}
          folderNavigation={folderNavigation}
          previewFile={setPreview}
          showParentRow
          emptyDescription="Документов пока нет"
          downloadFile={downloadFile}
          deleteFile={result.canDelete ? setDeleting : undefined}
          deleteDisabled={busy}
        />
        {deleting && (
          <Modal
            open
            title={`Удалить файл «${deleting.title}»?`}
            okText="Удалить"
            okButtonProps={{ danger: true }}
            confirmLoading={busy}
            cancelText="Отмена"
            onCancel={() => !busy && setDeleting(undefined)}
            onOk={deleteFile}
          >
            Файл будет удалён из карточки и хранилища.
          </Modal>
        )}
        {previewTarget && <DocumentPreviewDialog file={previewTarget} onClose={() => setPreview(undefined)} />}
      </div>
    </div>
  );
}
