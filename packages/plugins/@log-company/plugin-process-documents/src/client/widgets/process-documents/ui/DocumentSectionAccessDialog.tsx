/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useEffect, useState } from 'react';
import { Alert, Button, Modal, Select, Space, Spin, Typography } from 'antd';
import {
  isCompanyRequestFolder,
  type DocumentAccessRule,
  type DocumentFolderDto,
  type DocumentSection,
  type SectionAccessResponse,
} from '../../../../contracts/processDocuments';
import { ProcessDocumentsApi, getDocumentErrorText } from '../../../entities/process-document';
import type { CatalogItem } from '../../../entities/process-document';
import { DocumentPermissionsMatrix } from './DocumentPermissionsMatrix';
import { folderAccessRules, folderAccessValue } from './DocumentFolderAccessDialog';

const sections = [
  { value: 'ved', label: 'ВЭД' },
  { value: 'permits', label: 'Разрешительные документы' },
  { value: 'contracts', label: 'Контракты' },
  { value: 'requests', label: 'По запросу' },
] as const satisfies readonly { value: DocumentSection; label: string }[];

export function DocumentSectionAccessDialog({
  api,
  company,
  onClose,
  onSaved,
}: {
  api: ProcessDocumentsApi;
  company?: CatalogItem;
  onClose(): void;
  onSaved(): void;
}) {
  const companyId = company?.id;
  const [target, setTarget] = useState<string>(sections[0].value);
  const [folders, setFolders] = useState<DocumentFolderDto[]>([]);
  const [foldersError, setFoldersError] = useState<string>();
  const [retryFolders, setRetryFolders] = useState(0);
  const [result, setResult] = useState<{ target: string; access?: SectionAccessResponse; error?: string }>();
  const [draft, setDraft] = useState<DocumentAccessRule[]>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const folder = folders.find(({ id }) => target === 'folder:' + id);
  const section = sections.find(({ value }) => value === target)?.value;
  const access = folder
    ? { rules: folderAccessRules(folder.grants), inherited: [] }
    : result?.target === target
      ? result.access
      : undefined;

  useEffect(() => {
    if (companyId === undefined) return;
    let active = true;
    setFoldersError(undefined);
    api
      .list({ companyId, companyArea: 'company' }, null)
      .then(({ folders: entries }) => {
        if (active) setFolders(entries.filter(({ title }) => !isCompanyRequestFolder(title)));
      })
      .catch((reason) => {
        if (active) setFoldersError(getDocumentErrorText(reason, 'Не удалось загрузить папки компании.'));
      });
    return () => {
      active = false;
    };
  }, [api, companyId, retryFolders]);

  useEffect(() => {
    if (!section) return;
    let active = true;
    api
      .sectionAccess(section, companyId)
      .then((value) => {
        if (active) setResult({ target: section, access: value });
      })
      .catch((reason) => {
        if (active) setResult({ target: section, error: getDocumentErrorText(reason, 'Не удалось загрузить права.') });
      });
    return () => {
      active = false;
    };
  }, [api, companyId, section]);

  function changeTarget(value: string) {
    const apply = () => {
      setDraft(undefined);
      setError(undefined);
      setTarget(value);
    };
    if (!draft) return apply();
    Modal.confirm({
      title: 'Перейти без сохранения прав?',
      okText: 'Перейти',
      cancelText: 'Отмена',
      onOk: apply,
    });
  }

  async function save() {
    if (!draft || saving) return;
    setSaving(true);
    setError(undefined);
    try {
      if (folder) {
        const grants = folderAccessValue(folder.grants, draft);
        await api.setFolderAccess(folder.id, grants);
        setFolders((entries) => entries.map((entry) => (entry.id === folder.id ? { ...entry, grants } : entry)));
      } else if (section) {
        await api.setSectionAccess(section, companyId, draft);
        setResult((previous) => previous?.access && { target, access: { ...previous.access, rules: draft } });
      }
      setDraft(undefined);
      onSaved();
    } catch (reason) {
      setError(getDocumentErrorText(reason, 'Не удалось сохранить права.'));
    } finally {
      setSaving(false);
    }
  }

  const sectionError = result?.target === target ? result.error : undefined;
  return (
    <Modal
      open
      title={company ? 'Права на документы · ' + company.title : 'Права на документы · Все компании'}
      width={820}
      okText="Сохранить права"
      cancelText="Закрыть"
      okButtonProps={{ disabled: !draft || !access }}
      confirmLoading={saving}
      cancelButtonProps={{ disabled: saving }}
      onOk={save}
      onCancel={onClose}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Select
          aria-label="Папка первого уровня"
          value={target}
          options={[...sections, ...folders.map(({ id, title }) => ({ label: title, value: 'folder:' + id }))]}
          style={{ minWidth: 250 }}
          disabled={saving}
          onChange={changeTarget}
        />
        <Typography.Text type="secondary">
          {company ? 'Права папок первого уровня этой компании.' : 'Типовые права действуют во всех компаниях.'}
        </Typography.Text>
        {foldersError && (
          <Alert
            type="error"
            message={foldersError}
            action={<Button onClick={() => setRetryFolders((previous) => previous + 1)}>Повторить</Button>}
          />
        )}
        {(sectionError || error) && <Alert type="error" message={sectionError || error} />}
        {access ? (
          <DocumentPermissionsMatrix
            key={target}
            rules={draft ?? access.rules}
            inherited={access.inherited}
            defaultAllow={!Array.isArray(folder?.grants) && folder?.grants?.defaultAllow !== false}
            disabled={saving}
            onChange={setDraft}
          />
        ) : (
          !sectionError && <Spin aria-label="Загрузка прав" />
        )}
      </Space>
    </Modal>
  );
}
