/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { isTransportRunActionContext } from '../RunTreeActionModel';

describe('RunTreeActionModel', () => {
  it('is available for transport run records', () => {
    expect(isTransportRunActionContext({ collection: { name: 'transport_runs' } })).toBe(true);
    expect(isTransportRunActionContext({ collection: { collectionName: 'transport_runs' } })).toBe(true);
    expect(isTransportRunActionContext({ blockModel: { collection: { name: 'transport_runs' } } })).toBe(true);
  });

  it('stays hidden for unrelated collections', () => {
    expect(isTransportRunActionContext({ collection: { name: 'shipments' } })).toBe(false);
    expect(isTransportRunActionContext({})).toBe(false);
  });
});
