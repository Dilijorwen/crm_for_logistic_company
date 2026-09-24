/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import type { LogisticsRepository, TrackedLogisticsField } from '../ports/LogisticsRepository';
import { RecordLogisticsCreated } from '../RecordLogisticsCreated';
import { WriteLogisticsHistory } from '../WriteLogisticsHistory';

const fields: TrackedLogisticsField[] = [
  {
    name: 'status',
    label: 'Статус',
    storageKey: 'status',
    kind: 'scalar',
    enumOptions: [{ value: 'queue', label: 'В очереди' }],
  },
  {
    name: 'company',
    label: 'Наша компания',
    storageKey: 'company_id',
    kind: 'belongsTo',
    targetCollection: 'our_companies',
    targetKey: 'id',
  },
  { name: 'documents_in_badis', label: 'Документы в БАДИС', storageKey: 'documents_in_badis', kind: 'scalar' },
  { name: 'manager_comment', label: 'Комментарий', storageKey: 'manager_comment', kind: 'scalar' },
];

describe('RecordLogisticsCreated', () => {
  it('records every populated initial business field for a shipment', async () => {
    const repository = {
      historyCollectionExists: vi.fn(() => true),
      getEntityLabel: vi.fn(async () => 'Поставка №11'),
      getTrackedFields: vi.fn(() => fields),
      findEntityValues: vi.fn(async () => ({
        status: 'queue',
        company: 'company-1',
        documents_in_badis: false,
        manager_comment: '',
      })),
      getRecordLabel: vi.fn(async () => 'Логистика'),
      createHistory: vi.fn(async () => undefined),
    } as unknown as LogisticsRepository;
    const logger = { warn: vi.fn(), error: vi.fn() };
    const history = new WriteLogisticsHistory(repository, logger);

    await new RecordLogisticsCreated(repository, history, logger).execute({
      entityKind: 'shipment',
      entityId: 'shipment-11',
    });

    expect(repository.createHistory).toHaveBeenCalledTimes(4);
    expect(repository.createHistory).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ eventType: 'created', newValue: 'Поставка №11' }),
      undefined,
      undefined,
    );
    expect(repository.createHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'field_initialized',
        fieldName: 'status',
        newValue: 'В очереди',
      }),
      undefined,
      undefined,
    );
    expect(repository.createHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'field_initialized',
        fieldName: 'company',
        newValue: 'Логистика',
      }),
      undefined,
      undefined,
    );
    expect(repository.createHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'field_initialized',
        fieldName: 'documents_in_badis',
        newValue: 'false',
      }),
      undefined,
      undefined,
    );
  });
});
