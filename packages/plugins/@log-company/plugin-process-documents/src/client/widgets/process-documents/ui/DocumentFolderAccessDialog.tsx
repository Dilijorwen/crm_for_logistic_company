/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useState } from 'react';
import { Alert, Modal, Space, Typography } from 'antd';
import type { DocumentAccessRule, DocumentFolderDto, FolderAccess } from '../../../../contracts/processDocuments';
import { getDocumentErrorText } from '../../../entities/process-document';
import { DocumentPermissionsMatrix } from './DocumentPermissionsMatrix';

export function folderAccessRules(access?: FolderAccess | null): DocumentAccessRule[] {
  return Array.isArray(access)
    ? access.map(({ kind, subject, level }) => ({
        kind,
        subject,
        rights: { read: true, write: level !== 'read', rename: level !== 'read', delete: level === 'delete' },
      }))
    : access?.rules ?? [];
}

export function folderAccessValue(
  access: FolderAccess | null | undefined,
  rules: DocumentAccessRule[],
): FolderAccess | null {
  const defaultAllow = Array.isArray(access) ? false : access?.defaultAllow;
  return rules.length || defaultAllow === false ? { rules, defaultAllow } : null;
}

export function DocumentFolderAccessDialog({
  folder,
  path,
  onSave,
  onClose,
}: {
  folder: DocumentFolderDto;
  path?: string;
  onSave: (grants: FolderAccess | null) => Promise<void>;
  onClose: () => void;
}) {
  const access = folder.grants;
  const defaultAllow = Array.isArray(access) ? false : access?.defaultAllow;
  const [rules, setRules] = useState(() => folderAccessRules(access));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [dirty, setDirty] = useState(false);

  async function save() {
    if (saving || !dirty) return;
    setSaving(true);
    setError(undefined);
    try {
      await onSave(folderAccessValue(access, rules));
    } catch (reason) {
      setError(getDocumentErrorText(reason, 'Не удалось сохранить права папки.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      width={760}
      title={`Права папки «${folder.title}»`}
      okText="Сохранить права"
      cancelText="Отмена"
      confirmLoading={saving}
      okButtonProps={{ disabled: !dirty }}
      cancelButtonProps={{ disabled: saving }}
      onOk={save}
      onCancel={onClose}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {error && <Alert type="error" message={error} />}
        {path && <Typography.Text strong>{path}</Typography.Text>}
        <Typography.Text type="secondary">
          Права папки действуют в пределах доступа к родительским папкам и исходной записи.
        </Typography.Text>
        {!String(folder.id).startsWith('virtual-folder:') && (
          <Typography.Text type="secondary">ID папки: {folder.id}</Typography.Text>
        )}
        <DocumentPermissionsMatrix
          rules={rules}
          defaultAllow={defaultAllow}
          disabled={saving}
          onChange={(next) => {
            setRules(next);
            setDirty(true);
          }}
        />
      </Space>
    </Modal>
  );
}
