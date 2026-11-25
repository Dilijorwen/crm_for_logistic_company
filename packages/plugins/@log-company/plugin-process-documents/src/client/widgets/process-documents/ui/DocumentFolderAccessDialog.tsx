/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useEffect, useState } from 'react';
import { Alert, Button, Modal, Space, Spin, Typography } from 'antd';
import type {
  DocumentAccessRule,
  DocumentFolderDto,
  DocumentIdentifier,
  FolderAccess,
  FolderAccessConstraint,
} from '../../../../contracts/processDocuments';
import { getDocumentErrorText, type ProcessDocumentsApi } from '../../../entities/process-document';
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
  api,
  companyId,
  path,
  onSave,
  onClose,
}: {
  folder: DocumentFolderDto;
  api: ProcessDocumentsApi;
  companyId?: DocumentIdentifier;
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

  const [constraints, setConstraints] = useState<FolderAccessConstraint[]>();
  const [constraintsError, setConstraintsError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const isVirtual = String(folder.id).startsWith('virtual-folder:');

  useEffect(() => {
    if (isVirtual) return;
    let active = true;
    setConstraintsError(undefined);
    api
      .folderConstraints(folder.id, companyId)
      .then((value) => {
        if (active) setConstraints(value);
      })
      .catch((reason) => {
        if (active) setConstraintsError(getDocumentErrorText(reason, 'Не удалось загрузить унаследованные права.'));
      });
    return () => {
      active = false;
    };
  }, [api, folder.id, companyId, isVirtual, attempt]);

  async function save() {
    if (saving || !dirty || (!isVirtual && !constraints)) return;
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
      okButtonProps={{ disabled: !dirty || (!isVirtual && !constraints) }}
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
        {!isVirtual && <Typography.Text type="secondary">ID папки: {folder.id}</Typography.Text>}
        {constraintsError ? (
          <Alert
            type="error"
            message={constraintsError}
            action={<Button onClick={() => setAttempt((value) => value + 1)}>Повторить</Button>}
          />
        ) : isVirtual || constraints ? (
          <DocumentPermissionsMatrix
            rules={rules}
            constraints={constraints}
            defaultAllow={defaultAllow}
            disabled={saving}
            onChange={(next) => {
              setRules(next);
              setDirty(true);
            }}
          />
        ) : (
          <Spin aria-label="Загрузка унаследованных прав" />
        )}
      </Space>
    </Modal>
  );
}
