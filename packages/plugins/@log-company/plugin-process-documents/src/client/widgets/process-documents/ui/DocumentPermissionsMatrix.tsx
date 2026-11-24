/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useEffect, useState } from 'react';
import { useAPIClient } from '@nocobase/client';
import { Alert, Button, Checkbox, Input, Pagination, Segmented, Space, Table } from 'antd';
import { documentRights } from '../../../../contracts/processDocuments';
import type { DocumentAccessRule, DocumentRight, DocumentRights } from '../../../../contracts/processDocuments';
import { getDocumentErrorText } from '../../../entities/process-document';

type Recipient = { subject: string; title: string; roles: string[] };
type Kind = DocumentAccessRule['kind'];
const captions: Record<DocumentRight, string> = {
  read: 'Просмотр',
  write: 'Загрузка',
  rename: 'Переименование',
  delete: 'Удаление',
};
const pageSize = 25;

export function DocumentPermissionsMatrix({
  rules,
  inherited = [],
  defaultAllow = true,
  onChange,
  disabled = false,
}: {
  rules: DocumentAccessRule[];
  inherited?: DocumentAccessRule[];
  defaultAllow?: boolean;
  onChange: (rules: DocumentAccessRule[]) => void;
  disabled?: boolean;
}) {
  const api = useAPIClient();
  const [kind, setKind] = useState<Kind>('role');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ recipients: Recipient[]; total: number }>();
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [preset, setPreset] = useState('read');

  useEffect(() => {
    let active = true;
    setResult(undefined);
    setError(undefined);
    const timeout = setTimeout(async () => {
      try {
        const fields = kind === 'role' ? ['name', 'title'] : ['id', 'nickname', 'username'];
        const term = search.trim();
        const response = await api.resource(kind === 'role' ? 'roles' : 'users').list({
          page,
          pageSize,
          fields,
          sort: [fields[0]],
          ...(kind === 'user' && { appends: ['roles.name'] }),
          ...(term && {
            filter: {
              $or: fields.filter((field) => field !== 'id').map((field) => ({ [field]: { $includes: term } })),
            },
          }),
        });
        const rows = response.data?.data;
        if (!Array.isArray(rows)) throw new Error('Сервер вернул некорректный список.');
        const recipients = rows.flatMap((value: unknown): Recipient[] => {
          if (!value || typeof value !== 'object') return [];
          const row = value as Record<string, unknown>;
          const subject = kind === 'role' ? row.name : row.id;
          if (typeof subject !== 'string' && typeof subject !== 'number') return [];
          const title = kind === 'role' ? row.title || row.name : row.nickname || row.username;
          const roles = Array.isArray(row.roles)
            ? row.roles.flatMap((role) => (typeof role?.name === 'string' ? [role.name] : []))
            : [];
          return [{ subject: String(subject), title: String(title || subject), roles }];
        });
        const count = response.data?.meta?.count;
        if (active) setResult({ recipients, total: typeof count === 'number' ? count : recipients.length });
      } catch (reason) {
        if (active) setError(getDocumentErrorText(reason, 'Не удалось загрузить список.'));
      }
    }, 180);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [api, kind, search, page, retry]);

  const visible = result?.recipients ?? [];
  const rowRule = (values: DocumentAccessRule[], kind: Kind, subject: string) =>
    values.find((rule) => rule.kind === kind && rule.subject === subject)?.rights;
  const inheritedValue = ({ subject, roles }: Recipient, right: DocumentRight) => {
    const inheritedPerson = rowRule(inherited, kind, subject)?.[right];
    if (kind === 'role' || !roles.length) return inheritedPerson ?? defaultAllow;
    return roles.some(
      (role) =>
        rowRule(rules, 'role', role)?.[right] ??
        inheritedPerson ??
        rowRule(inherited, 'role', role)?.[right] ??
        defaultAllow,
    );
  };
  const checked = (recipient: Recipient, right: DocumentRight) =>
    rowRule(rules, kind, recipient.subject)?.[right] ?? inheritedValue(recipient, right);

  function apply(recipients: Recipient[], changes: DocumentRights) {
    const next = new Map(rules.map((rule) => [`${rule.kind}:${rule.subject}`, rule]));
    for (const recipient of recipients) {
      const { subject } = recipient;
      const key = `${kind}:${subject}`;
      const rights = { ...next.get(key)?.rights };
      for (const right of documentRights) {
        const value = changes[right];
        if (value === undefined) continue;
        if (value === inheritedValue(recipient, right)) delete rights[right];
        else rights[right] = value;
      }
      if (Object.keys(rights).length) next.set(key, { kind, subject, rights });
      else next.delete(key);
    }
    onChange([...next.values()]);
  }

  function toggle(recipients: Recipient[], right: DocumentRight, value: boolean) {
    if (right === 'read' && !value) apply(recipients, { read: false, write: false, rename: false, delete: false });
    else if (right !== 'read' && value) apply(recipients, { read: true, [right]: true });
    else apply(recipients, { [right]: value });
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Space wrap>
        <Segmented
          value={kind}
          disabled={disabled}
          options={[
            { value: 'role', label: 'Роли' },
            { value: 'user', label: 'Исключения для сотрудников' },
          ]}
          onChange={(value) => {
            setResult(undefined);
            setKind(value as Kind);
            setSearch('');
            setPage(1);
            setSelected([]);
          }}
        />
        <Input.Search
          aria-label={kind === 'role' ? 'Поиск по ролям' : 'Поиск по сотрудникам'}
          placeholder={kind === 'role' ? 'Найти роль' : 'Найти сотрудника'}
          allowClear
          value={search}
          onChange={(event) => {
            setResult(undefined);
            setSearch(event.target.value);
            setPage(1);
            setSelected([]);
          }}
        />
      </Space>
      {error && (
        <Alert type="error" message={error} action={<Button onClick={() => setRetry(retry + 1)}>Повторить</Button>} />
      )}
      <Table<Recipient>
        rowKey="subject"
        size="small"
        loading={!result && !error}
        dataSource={visible}
        pagination={false}
        rowSelection={
          kind === 'role'
            ? {
                selectedRowKeys: selected,
                onChange: (keys) => setSelected(keys.map(String)),
                getCheckboxProps: () => ({ disabled }),
              }
            : undefined
        }
        columns={[
          { title: kind === 'role' ? 'Роль' : 'Сотрудник', dataIndex: 'title' },
          ...documentRights.map((right) => {
            const count = visible.filter((recipient) => checked(recipient, right)).length;
            const mixed = count > 0 && count < visible.length;
            return {
              key: right,
              align: 'center' as const,
              title: (
                <Space direction="vertical" size={2}>
                  {captions[right]}
                  <Checkbox
                    aria-label={`${captions[right]} для всех видимых строк`}
                    checked={visible.length > 0 && count === visible.length}
                    indeterminate={mixed}
                    aria-checked={mixed ? 'mixed' : undefined}
                    disabled={disabled || !visible.length}
                    onChange={(event) => toggle(visible, right, event.target.checked)}
                  />
                </Space>
              ),
              render: (_value: unknown, recipient: Recipient) => (
                <Checkbox
                  aria-label={`${recipient.title} · ${captions[right]}`}
                  checked={checked(recipient, right)}
                  disabled={disabled}
                  onChange={(event) => toggle([recipient], right, event.target.checked)}
                />
              ),
            };
          }),
        ]}
      />
      {selected.length > 0 && (
        <Space wrap>
          <Segmented
            value={preset}
            onChange={(value) => setPreset(String(value))}
            disabled={disabled}
            options={[
              { value: 'none', label: 'Без доступа' },
              { value: 'read', label: 'Просмотр' },
              { value: 'write', label: 'Просмотр и загрузка' },
              { value: 'delete', label: 'Все действия' },
            ]}
          />
          <Button
            disabled={disabled}
            onClick={() => {
              apply(
                visible.filter(({ subject }) => selected.includes(subject)),
                {
                  read: preset !== 'none',
                  write: preset === 'write' || preset === 'delete',
                  rename: preset === 'delete',
                  delete: preset === 'delete',
                },
              );
              setSelected([]);
            }}
          >
            Применить к выбранным ({selected.length})
          </Button>
        </Space>
      )}
      {result && result.total > pageSize && (
        <Pagination
          size="small"
          pageSize={pageSize}
          current={page}
          total={result.total}
          showSizeChanger={false}
          onChange={(value) => {
            setResult(undefined);
            setPage(value);
            setSelected([]);
          }}
        />
      )}
    </Space>
  );
}
