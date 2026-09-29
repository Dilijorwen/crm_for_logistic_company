/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { FlowModel } from '@nocobase/flow-engine';
import { describe, expect, it } from 'vitest';
import { CollectionSearchActionModel } from '../features/collection-search/model';
import {
  getConfigurableSearchFields,
  resolveSearchInputValue,
} from '../features/collection-search/model/CollectionSearchActionModel';
import { canConfigureCollectionSearch } from '../plugin';

describe('collection search settings visibility', () => {
  const searchModel = Object.create(CollectionSearchActionModel.prototype) as FlowModel;
  const otherModel = {} as FlowModel;

  it('shows search action settings only to root', () => {
    expect(canConfigureCollectionSearch(searchModel, 'root')).toBe(true);
    expect(canConfigureCollectionSearch(searchModel, 'member')).toBe(false);
  });

  it('does not change settings visibility for other models', () => {
    expect(canConfigureCollectionSearch(otherModel, 'member')).toBe(true);
  });
});

describe('collection search field settings', () => {
  it('offers meaningful scalar and relation fields and excludes technical fields', () => {
    const fields = getConfigurableSearchFields({
      getFields: () => [
        { name: 'id', type: 'snowflakeId', interface: 'integer', primaryKey: true },
        { name: 'vehicle_id', type: 'bigInt', interface: 'integer', isForeignKey: true },
        { name: 'comment', type: 'text', interface: 'textarea', uiSchema: { title: 'Комментарий' } },
        { name: 'vehicle', type: 'belongsTo', interface: 'm2o', target: 'vehicles', uiSchema: { title: 'Машина' } },
        { name: 'files', type: 'belongsToMany', interface: 'attachment', target: 'attachments' },
        { name: 'sort', type: 'sort', interface: 'sort' },
      ],
    });

    expect(fields).toEqual([
      { key: 'comment', title: 'Комментарий' },
      { key: 'vehicle', title: 'Машина' },
    ]);
  });
});

describe('collection search input draft', () => {
  it('preserves the remaining two characters when the active three-character search is cleared', () => {
    expect(resolveSearchInputValue('ab', null)).toBe('ab');
  });

  it('uses the active resource search term before the user changes the input', () => {
    expect(resolveSearchInputValue(undefined, 'abc')).toBe('abc');
  });

  it('keeps an explicitly cleared draft empty instead of restoring the previous resource term', () => {
    expect(resolveSearchInputValue('', 'abc')).toBe('');
  });
});
