/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { defaultDocumentSectionRights, type DocumentAccessRule } from '../../../../../contracts/processDocuments';
import { DocumentPermissionsMatrix } from '../DocumentPermissionsMatrix';

const client = vi.hoisted(() => ({ list: vi.fn(), resource: vi.fn() }));
vi.mock('@nocobase/client', () => ({ useAPIClient: () => client }));

it('переключает всю видимую колонку и сохраняет правила за пределами поиска', async () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: false, media: query, addListener: vi.fn(), removeListener: vi.fn() }),
  });
  const roles = [
    { name: 'declarant', title: 'Декларанты' },
    { name: 'manager', title: 'Менеджеры' },
  ];
  client.resource.mockReturnValue({ list: client.list });
  client.list.mockImplementation(async ({ filter }) => ({
    data: { data: filter ? roles.slice(0, 1) : roles },
  }));

  function Editor() {
    const [rules, setRules] = useState<DocumentAccessRule[]>([
      { kind: 'role', subject: 'manager', rights: { write: false } },
    ]);
    return <DocumentPermissionsMatrix rules={rules} onChange={setRules} />;
  }
  render(<Editor />);
  await screen.findByRole('checkbox', { name: 'Менеджеры · Загрузка' });
  const all = screen.getByRole('checkbox', { name: 'Загрузка для всех видимых строк' });
  expect(all).toBePartiallyChecked();
  fireEvent.click(all);
  expect(screen.getByRole('checkbox', { name: 'Менеджеры · Загрузка' })).toBeChecked();
  fireEvent.click(all);
  expect(screen.getByRole('checkbox', { name: 'Декларанты · Загрузка' })).not.toBeChecked();

  fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск по ролям' }), { target: { value: 'декл' } });
  await waitFor(() => expect(all).toBeEnabled());
  fireEvent.click(all);
  expect(screen.getByRole('checkbox', { name: 'Декларанты · Загрузка' })).toBeChecked();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск по ролям' }), { target: { value: '' } });
  expect(await screen.findByRole('checkbox', { name: 'Менеджеры · Загрузка' })).not.toBeChecked();
});

it('показывает удаление в ВЭД выключенным по умолчанию и сохраняет явное разрешение', async () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: false, media: query, addListener: vi.fn(), removeListener: vi.fn() }),
  });
  client.resource.mockReturnValue({ list: client.list });
  client.list.mockResolvedValue({ data: { data: [{ name: 'manager', title: 'Менеджеры' }] } });
  const onChange = vi.fn();
  render(
    <DocumentPermissionsMatrix rules={[]} defaultAllow={defaultDocumentSectionRights('ved')} onChange={onChange} />,
  );
  const remove = await screen.findByRole('checkbox', { name: 'Менеджеры · Удаление' });
  expect(remove).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Менеджеры · Просмотр' })).toBeChecked();
  fireEvent.click(remove);
  expect(onChange).toHaveBeenLastCalledWith([{ kind: 'role', subject: 'manager', rights: { delete: true } }]);
});

it('показывает запрет ВЭД даже при явном разрешении папки и пропускает строку при массовом изменении', async () => {
  client.resource.mockReturnValue({ list: client.list });
  client.list.mockResolvedValue({
    data: {
      data: [
        { name: 'certificate', title: 'Сертификатчик' },
        { name: 'manager', title: 'Менеджер' },
      ],
    },
  });
  const rules: DocumentAccessRule[] = [{ kind: 'role', subject: 'certificate', rights: { read: true } }];
  const onChange = vi.fn();
  render(
    <DocumentPermissionsMatrix
      rules={rules}
      onChange={onChange}
      constraints={[
        {
          type: 'section',
          title: 'ВЭД',
          section: 'ved',
          policies: [
            {
              inherited: [{ kind: 'role', subject: 'certificate', rights: { read: false } }],
              rules: [],
            },
          ],
        },
      ]}
    />,
  );
  const view = await screen.findByRole('checkbox', { name: 'Сертификатчик · Просмотр' });
  expect(view).not.toBeChecked();
  expect(view).toBeDisabled();
  expect(screen.getByText('Просмотр запрещён в разделе «ВЭД»')).toBeVisible();
  expect(screen.getByRole('checkbox', { name: 'Сертификатчик · Загрузка' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Загрузка для всех видимых строк' }));
  expect(onChange).toHaveBeenLastCalledWith([...rules, { kind: 'role', subject: 'manager', rights: { write: false } }]);
});
