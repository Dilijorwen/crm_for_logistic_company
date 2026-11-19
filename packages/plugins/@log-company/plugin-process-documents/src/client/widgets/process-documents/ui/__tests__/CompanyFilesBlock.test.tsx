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
vi.mock('@nocobase/client', () => ({ useAPIClient: () => client }));
vi.mock('../DocumentsCatalogList', () => ({
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
    requestScope,
    readOnly,
  }: {
    children?: React.ReactNode;
    requestScope: DocumentRequestScope;
    readOnly: boolean;
  }) => (
    <>
      <output>{JSON.stringify(requestScope)}</output>
      {!readOnly && <button type="button">Загрузить</button>}
      {children}
    </>
  ),
}));

describe('Действия с документами из общего файлового менеджера', () => {
  it.each([false, true])('учитывает настройку блока «Только просмотр» (%s) для рейса и поставки', async (readOnly) => {
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
    expect(Boolean(screen.queryByRole('button', { name: 'Загрузить' }))).toBe(!readOnly);

    fireEvent.click(screen.getByRole('button', { name: 'Поставка №1042' }));
    expect(screen.getByRole('status')).toHaveTextContent('{"shipmentId":"42"}');
    expect(Boolean(screen.queryByRole('button', { name: 'Загрузить' }))).toBe(!readOnly);
  });

  it('показывает загрузку сразу в компании и скрывает разделы без права просмотра', async () => {
    client.request.mockResolvedValue({
      data: { data: { sections: { company: true, corporate: true, permits: false, ved: false } } },
    });
    render(<CompanyFilesBlock root={{ type: 'company', company: { id: '10', title: 'Компания' } }} />);
    expect(await screen.findByRole('button', { name: 'Загрузить' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Учредительные документы' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'ВЭД' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Разрешительные документы' })).toBeNull();
  });
});
