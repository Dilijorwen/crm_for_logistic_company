/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import type { LogisticsRepository } from '../ports/LogisticsRepository';
import { RecordLogisticsRelationChange } from '../RecordLogisticsRelationChange';
import { WriteLogisticsHistory } from '../WriteLogisticsHistory';

describe('RecordLogisticsRelationChange', () => {
  it('records a shipment link in both run and shipment histories', async () => {
    const repository = {
      historyCollectionExists: vi.fn(() => true),
      getEntityLabel: vi.fn(async (kind: string, id: string) => `${kind}:${id}`),
      createHistory: vi.fn(async () => undefined),
    } as unknown as LogisticsRepository;
    const logger = { warn: vi.fn(), error: vi.fn() };
    const action = new RecordLogisticsRelationChange(repository, new WriteLogisticsHistory(repository, logger));

    await action.execute({
      entityId: 'run-1',
      relatedId: 'shipment-2',
      relatedKind: 'shipment',
      eventType: 'shipment_attached',
      fieldName: 'shipments',
      fieldLabel: 'Поставки',
    });

    expect(repository.createHistory).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ entityKind: 'run', entityId: 'run-1', newValue: 'shipment:shipment-2' }),
      undefined,
      undefined,
    );
    expect(repository.createHistory).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ entityKind: 'shipment', entityId: 'shipment-2', newValue: 'run:run-1' }),
      undefined,
      undefined,
    );
  });

  it('records a parent link in both child and parent run histories', async () => {
    const repository = {
      historyCollectionExists: vi.fn(() => true),
      getEntityLabel: vi.fn(async (_kind: string, id: string) => `run:${id}`),
      createHistory: vi.fn(async () => undefined),
    } as unknown as LogisticsRepository;
    const logger = { warn: vi.fn(), error: vi.fn() };
    const action = new RecordLogisticsRelationChange(repository, new WriteLogisticsHistory(repository, logger));

    await action.execute({
      entityId: 'child-1',
      relatedId: 'parent-2',
      relatedKind: 'run',
      eventType: 'parent_added',
      fieldName: 'parent_runs',
      fieldLabel: 'Родительские рейсы',
    });

    expect(repository.createHistory).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        entityKind: 'run',
        entityId: 'child-1',
        eventType: 'parent_added',
        newValue: 'run:parent-2',
      }),
      undefined,
      undefined,
    );
    expect(repository.createHistory).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        entityKind: 'run',
        entityId: 'parent-2',
        eventType: 'child_added',
        fieldName: 'child_runs',
        newValue: 'run:child-1',
      }),
      undefined,
      undefined,
    );
  });
});
