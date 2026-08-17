/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { resolveCurrentCollection } from '../collectionContext';

describe('resolveCurrentCollection', () => {
  it('resolves the collection and data source from a FlowEngine context value', () => {
    expect(
      resolveCurrentCollection({
        name: 'customs_processes',
        options: { title: 'Таможенное оформление' },
        dataSource: { key: 'main' },
      }),
    ).toEqual({
      name: 'customs_processes',
      title: 'Таможенное оформление',
      dataSourceKey: 'main',
    });
  });

  it('falls back to the main data source and rejects an empty context', () => {
    expect(resolveCurrentCollection({ collectionName: 'orders' })).toEqual({
      name: 'orders',
      title: 'orders',
      dataSourceKey: 'main',
    });
    expect(resolveCurrentCollection(null)).toBeNull();
  });

  it('resolves current collection from an ancestor popup action', () => {
    const popupAction = {
      stepParams: {
        popupSettings: {
          openView: {
            collectionName: 'customs_processes',
            dataSourceKey: 'main',
          },
        },
      },
    };
    const block = {
      parent: {
        parent: {
          parent: popupAction,
        },
      },
    };

    expect(resolveCurrentCollection(undefined, block)).toEqual({
      name: 'customs_processes',
      title: 'customs_processes',
      dataSourceKey: 'main',
    });
  });
});
