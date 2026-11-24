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
import { loadWorkspaceHistory } from '../workspaceHistory';

function fixture(shipments: Array<{ id: string; shipment_number: number }>) {
  const commands = {
    transport_runs: { get: vi.fn().mockResolvedValue({ data: { data: { id: '7', run_number: 30 } } }) },
    'transport_runs.shipments': { list: vi.fn().mockResolvedValue({ data: { data: shipments } }) },
    'transport_runs.history': {
      list: vi.fn().mockResolvedValue({ data: { data: [{ id: '1', createdAt: '2026-11-18T10:00:00Z' }] } }),
    },
  };
  const perShipment = {
    '13': { list: vi.fn().mockResolvedValue({ data: { data: [{ id: '1', createdAt: '2026-11-19T10:00:00Z' }] } }) },
    '28': { list: vi.fn().mockResolvedValue({ data: { data: [{ id: '3', createdAt: '2026-11-17T10:00:00Z' }] } }) },
  };
  const resource = vi.fn((name: string, id?: string) =>
    name === 'shipments.history'
      ? perShipment[id as keyof typeof perShipment]
      : commands[name as keyof typeof commands],
  );
  return { api: { resource } as unknown as Pick<APIClient, 'resource'>, resource };
}

describe('Общая история рейса', () => {
  it('объединяет записи рейса и доступных поставок по времени с указанием источника', async () => {
    const { api, resource } = fixture([
      { id: '13', shipment_number: 23 },
      { id: '28', shipment_number: 41 },
    ]);

    const entries = await loadWorkspaceHistory(api, '7');

    expect(resource).toHaveBeenCalledWith('transport_runs.history', '7');
    expect(resource).toHaveBeenCalledWith('shipments.history', '13');
    expect(resource).toHaveBeenCalledWith('shipments.history', '28');
    expect(entries.map(({ key, source }) => ({ key, source }))).toEqual([
      { key: 'shipment:1', source: 'Поставка №23' },
      { key: 'run:1', source: 'Рейс №30' },
      { key: 'shipment:3', source: 'Поставка №41' },
    ]);
  });

  it('не запрашивает историю поставок, если доступных связанных поставок нет', async () => {
    const { api, resource } = fixture([]);

    expect(await loadWorkspaceHistory(api, '7')).toMatchObject([{ source: 'Рейс №30' }]);
    expect(resource).not.toHaveBeenCalledWith('shipments.history', expect.anything());
  });
});
