/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';
import { describe, expect, it, vi } from 'vitest';
import { DocumentsCatalogApi } from '../DocumentsCatalogApi';
import { ProcessDocumentsApi } from '../ProcessDocumentsApi';

describe('Documents catalog', () => {
  it('uses existing company and run links to open the same shipment from multiple runs', async () => {
    const list = vi
      .fn()
      .mockResolvedValue({ data: { data: [{ id: '42', shipment_number: 1042 }], meta: { count: 1 } } });
    const resource = vi.fn().mockReturnValue({ list });
    const api = new DocumentsCatalogApi({ resource } as unknown as APIClient);

    const first = await api.list({ kind: 'shipments', companyId: '10', runId: '87' }, 1);
    const second = await api.list({ kind: 'shipments', companyId: '10', runId: '88' }, 1);

    expect(resource).toHaveBeenCalledWith('shipments', undefined);
    expect(list).toHaveBeenNthCalledWith(1, expect.objectContaining({ filter: { company_id: '10', 'runs.id': '87' } }));
    expect(list).toHaveBeenNthCalledWith(2, expect.objectContaining({ filter: { company_id: '10', 'runs.id': '88' } }));
    expect(first.rows[0]).toEqual({ id: '42', title: 'Поставка №1042' });
    expect(second.rows[0]).toEqual(first.rows[0]);
  });

  it('lists the same run in both companies and restricts its shipments to the current company', async () => {
    const list = vi.fn().mockResolvedValue({ data: { data: [], meta: { count: 0 } } });
    const api = new DocumentsCatalogApi({ resource: () => ({ list }) } as unknown as APIClient);

    for (const companyId of ['10', '11']) {
      await api.list({ kind: 'runs', companyId }, 1);
      await api.list({ kind: 'shipments', companyId, runId: '87' }, 1);
    }
    await api.list({ kind: 'shipments', runId: '87' }, 1);

    expect(list.mock.calls.map(([params]) => params.filter)).toEqual([
      { 'shipments.company_id': '10' },
      { company_id: '10', 'runs.id': '87' },
      { 'shipments.company_id': '11' },
      { company_id: '11', 'runs.id': '87' },
      { 'runs.id': '87' },
    ]);
  });

  it('uses only the selected permit attachment association', async () => {
    const list = vi.fn().mockResolvedValue({ data: { data: [], meta: { count: 0 } } });
    const resource = vi.fn().mockReturnValue({ list });
    await new DocumentsCatalogApi({ resource } as unknown as APIClient).list(
      { kind: 'attachments', permitId: '10' },
      1,
    );
    expect(resource).toHaveBeenCalledWith('permit_documents.documents', '10');
    await new DocumentsCatalogApi({ resource } as unknown as APIClient).list(
      { kind: 'companyAttachments', companyId: '11' },
      1,
    );
    expect(resource).toHaveBeenLastCalledWith('our_companies.documents', '11');
  });

  it('sends the run and company IDs with a directory upload', async () => {
    const request = vi.fn().mockResolvedValue({});
    const file = new File(['test'], 'СМР.pdf');
    Object.defineProperty(file, 'webkitRelativePath', { value: 'Декларантам/СМР.pdf' });
    await new ProcessDocumentsApi({ request }).upload({ companyId: '10', runId: '87' }, null, [file]);
    const { data } = request.mock.calls[0][0];
    expect(data.get('companyId')).toBe('10');
    expect(data.get('runId')).toBe('87');
    expect(data.get('files').name).toBe('Декларантам/СМР.pdf');
  });
});
