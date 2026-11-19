/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { getProcessBlockModelContext } from '../blockModelContext';

describe('process block model context', () => {
  it('uses the current popup collection and key while preserving record, params and model identity', () => {
    const model = { uid: 'block' };
    const record = { id: 'outer' };
    const params = { page: 3 };
    const result = getProcessBlockModelContext(model, {
      collection: 'transport_runs',
      filterByTk: 'outer',
      record,
      params,
      view: { inputArgs: { collectionName: 'shipments', filterByTk: 0 } },
    });
    expect(result).toEqual({ collection: 'shipments', filterByTk: 0, record, params, model });
    expect(result.record).toBe(record);
    expect(result.params).toBe(params);
    expect(result.model).toBe(model);
  });

  it('falls back to block metadata only for absent popup values, keeping empty create-popup keys', () => {
    const model = {};
    expect(
      getProcessBlockModelContext(model, {
        collection: 'shipments',
        filterByTk: 'saved',
        view: { inputArgs: { filterByTk: '' } },
      }),
    ).toMatchObject({ collection: 'shipments', filterByTk: '' });
    expect(
      getProcessBlockModelContext(model, {
        collection: 'shipments',
        filterByTk: 'saved',
        view: { inputArgs: { filterByTk: null } },
      }),
    ).toMatchObject({ collection: 'shipments', filterByTk: 'saved' });
  });
});
