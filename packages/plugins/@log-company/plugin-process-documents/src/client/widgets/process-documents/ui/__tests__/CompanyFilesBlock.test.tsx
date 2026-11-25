/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { DocumentRequestScope } from '../../../../entities/process-document';
import { DocumentsCatalogApi } from '../../../../entities/process-document';
import { CompanyFilesBlock } from '../CompanyFilesBlock';

const client = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@nocobase/client', () => ({ useAPIClient: () => client, css: () => '' }));
vi.mock('../DocumentsCatalogList', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../DocumentsCatalogList')>()),
  DocumentsCatalogList: ({
    query,
    open,
  }: {
    query: { kind: string };
    open: (item: { id: string; title: string }) => void;
  }) => {
    const results: Record<string, { id: string; title: string }> = {
      runs: { id: '87', title: 'Рейс №87' },
      shipments: { id: '42', title: 'Поставка №1042' },
    };
    const item = results[query.kind];
    return item ? (
      <button type="button" onClick={() => open(item)}>
        {item.title}
      </button>
    ) : null;
  },
}));
vi.mock('../ScopedDocuments', () => ({
  ScopedDocuments: ({
    children,
    extraFolders,
    requestScope,
    readOnly,
  }: {
    children?: React.ReactNode;
    extraFolders?: Array<{ id: string; title: string; open(): void }>;
    requestScope: DocumentRequestScope;
    readOnly: boolean;
  }) => (
    <>
      <output>{JSON.stringify(requestScope)}</output>
      {!readOnly && <button type="button">Загрузить</button>}
      {extraFolders?.map((folder) => (
        <button key={folder.id} type="button" onClick={folder.open}>
          {folder.title}
        </button>
      ))}
      {children}
    </>
  ),
}));

describe('Действия с документами из общего файлового менеджера', () => {
  it.each([false, true])('открывает рейс и поставку для просмотра (%s)', async (readOnly) => {
    client.request.mockResolvedValue({
      data: { data: { sections: { company: true, corporate: true, permits: true, ved: true } } },
    });
    vi.spyOn(DocumentsCatalogApi.prototype, 'folders').mockResolvedValueOnce([
      {
        id: '2026',
        title: '2026',
        children: [{ id: '2026-11', title: 'Ноябрь', items: [{ id: '87', title: 'Рейс №87 - А123ВС' }] }],
      },
    ]);
    render(
      <CompanyFilesBlock root={{ type: 'company', company: { id: '10', title: 'Компания' } }} readOnly={readOnly} />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /ВЭД/ }));
    fireEvent.click(await screen.findByRole('button', { name: '2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ноябрь' }));
    fireEvent.click(screen.getByRole('button', { name: 'Рейс №87 - А123ВС' }));
    expect(JSON.parse(screen.getByRole('status').textContent || '')).toEqual({ companyId: '10', runId: '87' });
    expect(screen.queryByRole('button', { name: 'Загрузить' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Поставка №1042' }));
    expect(screen.getByRole('status')).toHaveTextContent('{"shipmentId":"42"}');
    expect(screen.queryByRole('button', { name: 'Загрузить' })).toBeNull();
  });

  it('ищет в текущей компании и открывает папку результата', async () => {
    client.request.mockImplementation(async ({ url }) => {
      if (url === 'processDocuments:search') {
        return {
          data: {
            data: [
              {
                id: '90',
                title: 'Устав.pdf',
                nodes: [{ type: 'company', company: { id: '10', title: 'Компания' } }],
                folders: [{ id: '21', title: 'Учредительные документы' }],
                target: { kind: 'scoped' },
              },
            ],
            meta: {},
          },
        };
      }
      return { data: { data: { sections: { company: true } } } };
    });
    render(<CompanyFilesBlock root={{ type: 'company', company: { id: '10', title: 'Компания' } }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Поиск по файлам' }));
    const search = screen.getByRole('textbox', { name: 'Поиск по файлам' });
    fireEvent.change(search, { target: { value: 'устав' } });

    expect(await screen.findByRole('button', { name: 'Устав.pdf' })).toBeVisible();
    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'processDocuments:search',
        data: expect.objectContaining({ query: 'устав', path: ['company:10'] }),
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Компания / Учредительные документы' }));
    expect(search).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Устав.pdf' })).toBeNull();
  });

  it('показывает загрузку сразу в компании и скрывает разделы без права просмотра', async () => {
    client.request.mockResolvedValue({
      data: { data: { sections: { company: true, corporate: true, permits: false, ved: false } } },
    });
    render(<CompanyFilesBlock root={{ type: 'company', company: { id: '10', title: 'Компания' } }} />);
    expect(await screen.findByRole('button', { name: 'Загрузить' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Учредительные документы' })).toBeNull();
    expect(screen.queryByText('Документы из карточки компании')).toBeNull();
    expect(screen.queryByRole('button', { name: 'ВЭД' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Разрешительные документы' })).toBeNull();
  });

  it.each([false, true])('открывает разрешительные обычным файловым блоком (%s)', async (readOnly) => {
    vi.spyOn(DocumentsCatalogApi.prototype, 'folders').mockResolvedValueOnce([{ id: 'active', title: 'Действителен' }]);
    render(
      <CompanyFilesBlock root={{ type: 'permits', company: { id: '10', title: 'Компания' } }} readOnly={readOnly} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('{"companyId":"10","companyArea":"permits"}');
    expect(await screen.findByRole('button', { name: 'Действителен' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Загрузить' })).toBeNull();
  });
});
