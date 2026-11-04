/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { getFlowModelPopupCollectionMode } from '../getFlowModelPopupCollectionMode';

describe('getFlowModelPopupCollectionMode', () => {
  it('reads the current record from the nearest child page view context', () => {
    const block = {
      parent: {
        context: { view: { inputArgs: { collectionName: 'shipments', filterByTk: 'shipment-42' } } },
      },
    };

    expect(getFlowModelPopupCollectionMode(block, 'shipments')).toBe('record');
  });

  it('recognizes an unsaved record when the child page has no filter key', () => {
    const block = {
      parent: {
        context: { view: { inputArgs: { collectionName: 'shipments' } } },
      },
    };

    expect(getFlowModelPopupCollectionMode(block, 'shipments')).toBe('create');
  });

  it('finds the collection configured by the field that opened a record popup', () => {
    const opener = {
      use: 'DisplayTextFieldModel',
      stepParams: { popupSettings: { openView: { collectionName: 'shipments' } } },
    };
    const block = { parent: { parent: opener } };

    expect(getFlowModelPopupCollectionMode(block, 'shipments')).toBe('record');
  });

  it('prioritizes a create action over inherited collection context', () => {
    const createAction = {
      use: 'AddNewActionModel',
      stepParams: { popupSettings: { openView: { collectionName: 'shipments' } } },
    };
    const block = { context: { collectionName: 'shipments' }, parent: { parent: createAction } };

    expect(getFlowModelPopupCollectionMode(block, 'shipments')).toBe('create');
  });

  it('resolves parents through the FlowEngine when direct parent references are absent', () => {
    const opener = {
      use: 'DisplayTextFieldModel',
      stepParams: { popupSettings: { openView: { collectionName: 'shipments' } } },
    };
    const getModel = vi.fn().mockReturnValue(opener);
    const block = { parentId: 'opener', flowEngine: { getModel } };

    expect(getFlowModelPopupCollectionMode(block, 'shipments')).toBe('record');
    expect(getModel).toHaveBeenCalledWith('opener', true);
  });

  it('ignores popups configured for another collection', () => {
    const block = {
      parent: {
        use: 'DisplayTextFieldModel',
        stepParams: { popupSettings: { openView: { collectionName: 'transport_runs' } } },
      },
    };

    expect(getFlowModelPopupCollectionMode(block, 'shipments')).toBeUndefined();
  });
});
