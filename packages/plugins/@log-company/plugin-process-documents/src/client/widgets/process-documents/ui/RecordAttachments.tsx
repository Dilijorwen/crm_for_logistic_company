/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { UploadOutlined } from '@ant-design/icons';
import { useAPIClient } from '@nocobase/client';
import { Alert, Button, Empty, List, Modal, Select, Space, Spin, message } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RecordAttachmentsApi, getDocumentErrorText, isDocumentAccessDenied } from '../../../entities/process-document';
import type { CatalogId, RecordAttachment, RecordAttachmentField } from '../../../entities/process-document';
import { DocumentPreviewDialog } from './DocumentPreviewDialog';

interface RecordAttachmentsProps {
  recordId: string | number;
  collection: string;
  dataSourceKey: string;
  fields: RecordAttachmentField[];
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
  canUpdateField,
}: Omit<RecordAttachmentsProps, 'fields'> & { field: RecordAttachmentField }) {
  const client = useAPIClient();
  const { name, multiple, readOnly } = field;
  const api = useMemo(
    () => new RecordAttachmentsApi(client, collection, recordId, name, multiple, dataSourceKey),
    [client, collection, recordId, name, multiple, dataSourceKey],
  );
  const [result, setResult] = useState<{
    files: RecordAttachment[];
    canUpdate: boolean;
    canDelete?: boolean;
    hidden?: boolean;
  }>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<CatalogId>();
  const [revision, setRevision] = useState(0);
  const [preview, setPreview] = useState<RecordAttachment>();
  const [deleting, setDeleting] = useState<RecordAttachment>();
  const busyRef = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    setError(undefined);
    setResult(undefined);
    async function load() {
      try {
        const files = await api.load();
        const fieldAccess =
          !files.hidden && !readOnly && Boolean(await canUpdateField?.(collection, name, dataSourceKey));
        if (active)
          setResult({
            ...files,
            canUpdate: files.canUpdate && fieldAccess,
            canDelete: (files.canDelete ?? files.canUpdate) && fieldAccess,
          });
      } catch (error) {
        if (!active) return;
        if (isDocumentAccessDenied(error)) setResult({ files: [], canUpdate: false, hidden: true });
        else setError(getDocumentErrorText(error, 'Не удалось загрузить список документов.'));
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [api, canUpdateField, collection, dataSourceKey, name, readOnly, revision]);

  async function mutate(work: () => Promise<void>, allowed = result?.canUpdate) {
    if (!allowed || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      await work();
      setRevision((value) => value + 1);
      return true;
    } catch (error) {
      message.error(getDocumentErrorText(error, 'Не удалось сохранить изменение.'));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function link(id: CatalogId) {
    await api.link(id);
    setPending(undefined);
  }

  async function upload(file?: File) {
    if (!file || pending !== undefined) return;
    await mutate(async () => {
      const id = await api.upload(file);
      setPending(id);
      await link(id);
    });
  }

  const previewTarget = useMemo(
    () => preview && { name: preview.title, load: (signal?: AbortSignal) => api.open(preview.id, signal) },
    [api, preview],
  );

  async function deleteFile() {
    if (!deleting) return;
    if (await mutate(() => api.deleteFile(deleting.id), result?.canDelete)) setDeleting(undefined);
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

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {result?.canUpdate && (multiple || !result.files.length || pending !== undefined) && (
        <Space wrap>
          <Button
            icon={<UploadOutlined aria-hidden="true" />}
            loading={busy}
            disabled={pending !== undefined}
            onClick={() => input.current?.click()}
          >
            Загрузить файл
          </Button>
          <input
            ref={input}
            type="file"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              return upload(file);
            }}
          />
          {pending !== undefined && (
            <Button loading={busy} onClick={() => mutate(() => link(pending))}>
              Повторить привязку файла
            </Button>
          )}
        </Space>
      )}
      <List
        size="small"
        dataSource={result.files}
        rowKey={(file) => file.id}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Документов пока нет" /> }}
        renderItem={(file) => (
          <List.Item
            actions={
              result.canDelete
                ? [
                    <Button key="delete" type="text" danger disabled={busy} onClick={() => setDeleting(file)}>
                      Удалить
                    </Button>,
                  ]
                : []
            }
          >
            <Button type="link" style={{ whiteSpace: 'normal', height: 'auto' }} onClick={() => setPreview(file)}>
              {file.title}
            </Button>
          </List.Item>
        )}
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
    </Space>
  );
}
