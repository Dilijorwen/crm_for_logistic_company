/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { LogisticsSnapshotStore } from '../LogisticsSnapshotStore';
import type { LogisticsRepository, TrackedLogisticsField } from '../ports/LogisticsRepository';
import { RecordLogisticsFieldChanges } from '../RecordLogisticsFieldChanges';
import { WriteLogisticsHistory } from '../WriteLogisticsHistory';

const fields: TrackedLogisticsField[] = [
  {
    name: 'invoice_number',
    label: 'Номер инвойса',
    storageKey: 'invoice_number',
    kind: 'scalar',
  },
  {
    name: 'company',
    label: 'Наша компания',
    storageKey: 'company_id',
    kind: 'belongsTo',
    targetCollection: 'our_companies',
    targetKey: 'id',
  },
  {
    name: 'customs_warehouse',
    label: 'СВХ',
    storageKey: 'customs_warehouse_id',
    kind: 'belongsTo',
    targetCollection: 'customs_warehouses',
    targetKey: 'id',
  },
];

describe('RecordLogisticsFieldChanges', () => {
  it('records every changed scalar and association even when related records have equal labels', async () => {
    const repository = {
      historyCollectionExists: vi.fn(() => true),
      getTrackedFields: vi.fn(() => fields),
      findEntityValues: vi.fn(async () => ({
        invoice_number: 'NEW-2',
        company: 'company-2',
        customs_warehouse: null,
      })),
      getRecordLabel: vi.fn(async () => 'Одинаковое название'),
      createHistory: vi.fn(async () => undefined),
    } as unknown as LogisticsRepository;
    const logger = { warn: vi.fn(), error: vi.fn() };
    const snapshots = new LogisticsSnapshotStore();
    snapshots.save('shipment', 'shipment-1', {
      invoice_number: 'OLD-1',
      company: 'company-1',
      customs_warehouse: null,
    });
    const history = new WriteLogisticsHistory(repository, logger);

    await new RecordLogisticsFieldChanges(repository, snapshots, history, logger).execute({
      entityKind: 'shipment',
      entityId: 'shipment-1',
    });

    expect(repository.createHistory).toHaveBeenCalledTimes(2);
    expect(repository.createHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldName: 'invoice_number',
        oldValue: 'OLD-1',
        newValue: 'NEW-2',
      }),
      undefined,
      undefined,
    );
    expect(repository.createHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldName: 'company',
        oldValue: 'Одинаковое название (ID: company-1)',
        newValue: 'Одинаковое название (ID: company-2)',
      }),
      undefined,
      undefined,
    );
  });
});
