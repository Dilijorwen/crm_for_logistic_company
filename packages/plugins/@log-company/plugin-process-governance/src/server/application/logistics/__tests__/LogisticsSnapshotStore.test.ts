/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { LogisticsSnapshotStore } from '../LogisticsSnapshotStore';

describe('LogisticsSnapshotStore', () => {
  it('keeps the first snapshot when one NocoBase update triggers repeated beforeUpdate hooks', () => {
    const store = new LogisticsSnapshotStore();
    const scope = {};

    store.save('shipment', 'shipment-1', { invoice_number: 'OLD', company: 'company-1' }, scope);
    store.save('shipment', 'shipment-1', { invoice_number: 'NEW', company: 'company-2' }, scope);

    expect(store.take('shipment', 'shipment-1', scope)).toEqual({
      invoice_number: 'OLD',
      company: 'company-1',
    });
  });

  it('accepts a new snapshot after the completed update consumes the previous one', () => {
    const store = new LogisticsSnapshotStore();

    store.save('run', 'run-1', { status: 'queue' });
    expect(store.take('run', 'run-1')).toEqual({ status: 'queue' });
    store.save('run', 'run-1', { status: 'in_work' });

    expect(store.take('run', 'run-1')).toEqual({ status: 'in_work' });
  });
});
