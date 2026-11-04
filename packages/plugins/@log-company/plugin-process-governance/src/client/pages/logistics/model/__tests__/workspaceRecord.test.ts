/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { isLogisticsWorkspaceContext, logisticsWorkspaceRecordIds } from '../workspaceRecord';

describe('logisticsWorkspaceRecordIds', () => {
  it('extracts the run and shipment identifiers from a linked work row', () => {
    expect(logisticsWorkspaceRecordIds({ id: '450:782' })).toEqual({ runId: '450', shipmentId: '782' });
  });

  it('keeps an unlinked run available for the first shipment', () => {
    expect(logisticsWorkspaceRecordIds({ id: '450:0' })).toEqual({ runId: '450', shipmentId: null });
  });

  it('rejects malformed workspace rows', () => {
    expect(logisticsWorkspaceRecordIds({ id: '450' })).toBeNull();
    expect(logisticsWorkspaceRecordIds({ id: '450:782:extra' })).toBeNull();
    expect(logisticsWorkspaceRecordIds({ id: 'bad:782' })).toBeNull();
    expect(logisticsWorkspaceRecordIds({ id: '0:782' })).toBeNull();
    expect(logisticsWorkspaceRecordIds({ id: '450:-1' })).toBeNull();
    expect(logisticsWorkspaceRecordIds({})).toBeNull();
  });

  it('only offers workspace actions on the combined collection', () => {
    expect(isLogisticsWorkspaceContext({ collection: { name: 'logistics_work_items' } })).toBe(true);
    expect(isLogisticsWorkspaceContext({ blockModel: { collection: { name: 'logistics_work_items' } } })).toBe(true);
    expect(isLogisticsWorkspaceContext({ collection: { name: 'transport_runs' } })).toBe(false);
    expect(isLogisticsWorkspaceContext(null)).toBe(false);
  });
});
