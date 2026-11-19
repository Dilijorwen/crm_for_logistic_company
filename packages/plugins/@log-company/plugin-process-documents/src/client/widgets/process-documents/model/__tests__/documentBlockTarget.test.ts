/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { documentBlockTarget } from '../documentBlockTarget';

vi.mock(
  '@log-company/plugin-process-governance/client',
  async () =>
    import('../../../../../../../plugin-process-governance/src/client/shared/lib/process-context/recordContext'),
);

describe('documents block context', () => {
  it.each([
    ['shipments', 'shipment'],
    ['our_companies', 'company'],
    ['transport_runs', 'run'],
    ['permit_documents', 'attachment'],
    ['other_records', 'attachment'],
  ])('uses the current %s record', (collection, kind) => {
    expect(documentBlockTarget({ collection: { name: collection }, filterByTk: '12', record: { id: '13' } })).toEqual({
      kind,
      collection,
      recordId: '12',
    });
  });

  it('keeps the shipment draft flow and waits for saved records otherwise', () => {
    expect(documentBlockTarget({ collection: 'shipments' }).kind).toBe('shipment');
    expect(documentBlockTarget({ collection: 'permit_documents' }).kind).toBe('unsaved');
  });

  it('uses the actual key supplied by collection metadata', () => {
    const collection = { name: 'other_records', filterTargetKey: 'number' };
    expect(documentBlockTarget({ collection, record: { number: 'P-5' } }).recordId).toBe('P-5');
  });
});
