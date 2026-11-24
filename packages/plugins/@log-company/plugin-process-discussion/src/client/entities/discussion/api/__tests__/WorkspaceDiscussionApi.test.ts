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
import { WorkspaceDiscussionApi } from '../WorkspaceDiscussionApi';

function fixture(deniedRun?: string) {
  const runs = [
    ['11', 101],
    ['22', 102],
    ['33', 103],
  ].map(([id, run_number]) => ({ id, run_number }));
  const shipments = [
    { id: '41', shipment_number: 201 },
    { id: '42', shipment_number: 202 },
  ];
  const response = (data: unknown) => ({ data: { data } });
  const denied = { response: { status: 403 } };
  const create = vi.fn();
  const api = {
    request: vi.fn(async ({ params }: { params: { runId: string } }) => {
      if (params.runId === deniedRun) throw denied;
      return response([{ id: params.runId === '22' ? '2' : '1', createdAt: '2026-11-20T10:00:00Z' }]);
    }),
    resource: vi.fn((name: string, id?: string) => ({
      create,
      get: async ({ filterByTk }: { filterByTk: string }) =>
        response((name === 'transport_runs' ? runs : shipments).find((row) => row.id === filterByTk)),
      list: async () => {
        if (name === 'transport_runs.shipments') return response(id === '22' ? shipments : [shipments[0]]);
        if (name === 'shipments.runs') return response(id === '41' ? runs.slice(0, 2) : [runs[1]]);
        if (name === 'shipments.comments') return response([{ id, createdAt: '2026-11-20T12:00:00Z' }]);
        throw new Error('Unexpected discussion source');
      },
    })),
  };
  return { discussion: new WorkspaceDiscussionApi(api as unknown as APIClient), api, create };
}

describe('Общее обсуждение связанных рейсов и поставок', () => {
  it('показывает одну ленту из обоих рейсов и из поставки без дублирования общей поставки', async () => {
    const { discussion } = fixture();
    const first = await discussion.list('run', '11', 1, 50);
    const second = await discussion.list('run', '22', 1, 50);
    const shipment = await discussion.list('shipment', '41', 1, 50);
    expect(first.data.map(({ messageKey, source }) => ({ messageKey, source }))).toEqual([
      { messageKey: 'shipment:42', source: 'Поставка №202' },
      { messageKey: 'shipment:41', source: 'Поставка №201' },
      { messageKey: 'run:2', source: 'Рейс №102' },
      { messageKey: 'run:1', source: 'Рейс №101' },
    ]);
    expect(second).toEqual(first);
    expect(shipment).toEqual(first);
  });

  it('не показывает сообщения из недоступного обсуждения', async () => {
    const { discussion } = fixture('22');
    const page = await discussion.list('run', '11', 1, 50);
    expect(page.data.map(({ source }) => source)).not.toContain('Рейс №102');
    expect(page.meta.count).toBe(3);
  });

  it('сохраняет новое сообщение с исходным рейсом', async () => {
    const { discussion, create } = fixture();
    await discussion.send('22', 'Отправлено', ['4']);
    expect(create).toHaveBeenCalledWith({ values: { runId: '22', text: 'Отправлено', attachmentIds: ['4'] } });
  });
});
