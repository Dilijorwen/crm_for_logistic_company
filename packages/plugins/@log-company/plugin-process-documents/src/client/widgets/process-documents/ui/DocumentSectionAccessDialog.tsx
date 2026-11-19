/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useEffect, useState } from 'react';
import { Alert, Modal, Select, Space, Spin, Typography } from 'antd';
import type {
  DocumentAccessRule,
  DocumentSection,
  SectionAccessResponse,
} from '../../../../contracts/processDocuments';
import { DocumentsCatalogApi, ProcessDocumentsApi, getDocumentErrorText } from '../../../entities/process-document';
import type { CatalogId, CatalogItem } from '../../../entities/process-document';
import { DocumentPermissionsMatrix } from './DocumentPermissionsMatrix';

const sections: { value: DocumentSection; label: string }[] = [
  { value: 'ved', label: 'ВЭД' },
  { value: 'corporate', label: 'Учредительные документы' },
  { value: 'permits', label: 'Разрешительные документы' },
  { value: 'company', label: 'Папка компании' },
];

export function DocumentSectionAccessDialog({
  api,
  catalogApi,
  company,
  onClose,
  onSaved,
}: {
  api: ProcessDocumentsApi;
  catalogApi: DocumentsCatalogApi;
  company?: CatalogItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [companyId, setCompanyId] = useState<CatalogId | undefined>(company?.id);
  const [section, setSection] = useState<DocumentSection>('ved');
  const [companies, setCompanies] = useState<CatalogItem[]>(company ? [company] : []);
  const [companiesError, setCompaniesError] = useState<string>();
  const [access, setAccess] = useState<SectionAccessResponse>();
  const [draft, setDraft] = useState<DocumentAccessRule[]>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    async function loadCompanies() {
      const items: CatalogItem[] = [];
      for (let page = 1; ; page++) {
        const { rows, total } = await catalogApi.list({ kind: 'companies' }, page);
        if (!active) return;
        items.push(...rows);
        if (!rows.length || items.length >= total) break;
      }
      setCompanies(items);
    }
    loadCompanies().catch((reason) => {
      if (active) setCompaniesError(getDocumentErrorText(reason, 'Не удалось загрузить компании.'));
    });
    return () => {
      active = false;
    };
  }, [catalogApi]);

  useEffect(() => {
    let active = true;
    setError(undefined);
    setAccess(undefined);
    api
      .sectionAccess(section, companyId)
      .then((data) => {
        if (active) setAccess(data);
      })
      .catch((reason) => {
        if (active) setError(getDocumentErrorText(reason, 'Не удалось загрузить права.'));
      });
    return () => {
      active = false;
    };
  }, [api, companyId, section]);

  function changeScope(change: () => void) {
    if (!draft) {
      change();
      return;
    }
    Modal.confirm({
      title: 'Перейти без сохранения прав?',
      okText: 'Перейти',
      cancelText: 'Отмена',
      onOk: () => {
        setDraft(undefined);
        change();
      },
    });
  }

  async function save() {
    if (!draft || saving) return;
    setSaving(true);
    setError(undefined);
    try {
      await api.setSectionAccess(section, companyId, draft);
      setAccess((previous) => previous && { ...previous, rules: draft });
      setDraft(undefined);
      onSaved();
    } catch (reason) {
      setError(getDocumentErrorText(reason, 'Не удалось сохранить права.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title="Права на документы"
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
        <Space wrap>
          <Select
            aria-label="Компании"
            style={{ minWidth: 205 }}
            value={companyId === undefined ? 'all' : String(companyId)}
            disabled={saving}
            options={[
              { label: 'Все компании · по умолчанию', value: 'all' },
              ...companies.map(({ id, title }) => ({ label: title, value: String(id) })),
            ]}
            onChange={(id) => changeScope(() => setCompanyId(id === 'all' ? undefined : id))}
          />
          <Select
            aria-label="Раздел"
            value={section}
            options={sections}
            style={{ minWidth: 195 }}
            disabled={saving}
            onChange={(value) => changeScope(() => setSection(value))}
          />
        </Space>
        <Typography.Text type="secondary">
          {companyId === undefined
            ? 'Общие права действуют в существующих и новых компаниях.'
            : 'Сохраните только отличия от общих прав.'}
        </Typography.Text>
        {companiesError && <Alert type="error" message={companiesError} />}
        {error && <Alert type="error" message={error} />}
        {access ? (
          <DocumentPermissionsMatrix
            key={`${companyId ?? 'all'}:${section}`}
            rules={draft ?? access.rules}
            inherited={access.inherited}
            disabled={saving}
            onChange={setDraft}
          />
        ) : (
          !error && <Spin size="small" />
        )}
      </Space>
    </Modal>
  );
}
