/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ values: {} as Record<string, unknown> }));
vi.mock('@nocobase/client', () => ({
  useCollection: () => state.values.collection,
  useCollectionManager: () => state.values.manager,
  useCollectionRecord: () => state.values.collectionRecord,
  useCurrentPopupRecord: () => state.values.popup,
  useDataBlockProps: () => state.values.dataBlock,
  useFormBlockContext: () => state.values.form,
  useRecord: () => state.values.record,
}));
vi.mock('@nocobase/flow-engine', () => ({ useFlowContext: () => state.values.flow }));
vi.mock(
  '@log-company/plugin-process-governance/client',
  async () => import('../../../../../../../plugin-process-governance/src/client/shared/lib'),
);

import { useProcessTarget } from '../useProcessTarget';

describe('shipment context precedence', () => {
  beforeEach(() => {
    state.values = {};
    window.history.replaceState(null, '', '/admin');
  });

  it('treats a create form as new even when an outer record and explicit key exist', () => {
    state.values = { form: { collectionName: 'shipments', type: 'create' }, record: { id: 'outer' } };
    expect(renderHook(() => useProcessTarget({ collection: 'shipments' }, 'explicit')).result.current).toEqual({
      status: 'new',
      source: 'form-create',
    });
  });

  it('uses the update form record before current values, initial values, service and popup', () => {
    state.values = {
      form: {
        collectionName: 'shipments',
        type: 'update',
        formRecord: { data: { id: 'form' } },
        form: { values: { id: 'values' }, initialValues: { id: 'initial' } },
        service: { data: { data: { id: 'service' } } },
      },
      popup: { collection: 'shipments', value: { id: 'popup' } },
    };
    expect(renderHook(() => useProcessTarget()).result.current).toEqual({
      status: 'ready',
      key: 'form',
      source: 'form-record',
    });
  });

  it('keeps zero keys and canonical composite collection keys', () => {
    state.values = {
      collection: { name: 'shipments', filterTargetKey: ['year', 'code'] },
      record: { year: 2026, code: 'a b' },
    };
    expect(renderHook(() => useProcessTarget()).result.current).toMatchObject({ key: 'code=a+b&year=2026' });
    state.values = {};
    expect(renderHook(() => useProcessTarget(undefined, 0)).result.current).toEqual({
      status: 'ready',
      key: 0,
      source: 'explicit-prop',
    });
  });

  it('uses the innermost nested popup, but ignores an unrelated standalone route', () => {
    window.history.replaceState(null, '', '/admin/filterbytk/run/view/child/filterbytk/shipment');
    expect(renderHook(() => useProcessTarget()).result.current).toEqual({
      status: 'ready',
      key: 'shipment',
      source: 'nested-popup-route',
    });
    window.history.replaceState(null, '', '/admin/filterbytk/run');
    expect(renderHook(() => useProcessTarget()).result.current).toEqual({ status: 'missing' });
  });

  it('distinguishes a loading update form and a new Flow popup', () => {
    state.values = { form: { collectionName: 'shipments', type: 'update' } };
    expect(renderHook(() => useProcessTarget()).result.current).toEqual({ status: 'loading', source: 'form-record' });
    state.values = { flow: { view: { inputArgs: { collectionName: 'shipments' } } } };
    expect(renderHook(() => useProcessTarget()).result.current).toEqual({ status: 'new', source: 'view-create' });
  });
  it.each([
    {
      form: {
        form: { values: { id: 'values' }, initialValues: { id: 'initial' } },
        service: { data: { data: { id: 'service' } } },
      },
      key: 'values',
      source: 'form-current-values',
    },
    {
      form: { form: { values: {}, initialValues: { id: 'initial' } }, service: { data: { data: { id: 'service' } } } },
      key: 'initial',
      source: 'form-initial-values',
    },
    {
      form: { form: { values: {}, initialValues: {} }, service: { data: { data: { id: 'service' } } } },
      key: 'service',
      source: 'form-service-data',
    },
  ])('falls through empty update candidates to $source', ({ form, key, source }) => {
    state.values = { form: { collectionName: 'shipments', type: 'update', ...form } };
    expect(renderHook(() => useProcessTarget()).result.current).toEqual({ status: 'ready', key, source });
  });

  it('prefers an explicit key over Flow and route fallback after local records are exhausted', () => {
    state.values = { flow: { view: { inputArgs: { collectionName: 'shipments', filterByTk: 'flow' } } } };
    window.history.replaceState(null, '', '/admin/filterbytk/route');
    expect(renderHook(() => useProcessTarget(undefined, 'explicit')).result.current).toEqual({
      status: 'ready',
      key: 'explicit',
      source: 'explicit-prop',
    });
    expect(renderHook(() => useProcessTarget()).result.current).toEqual({
      status: 'ready',
      key: 'flow',
      source: 'flow-view',
    });
  });

  it('uses query fallback only when the block belongs to a shipment', () => {
    window.history.replaceState(null, '', '/admin?filterByTk=route');
    expect(renderHook(() => useProcessTarget()).result.current).toEqual({ status: 'missing' });
    state.values = { collection: 'shipments', dataBlock: { filterByTk: 'filter' } };
    expect(renderHook(() => useProcessTarget()).result.current).toEqual({
      status: 'ready',
      key: 'filter',
      source: 'filterByTk',
    });
    state.values = { collection: 'shipments' };
    expect(renderHook(() => useProcessTarget()).result.current).toEqual({
      status: 'ready',
      key: 'route',
      source: 'route',
    });
  });

  it('recognizes model ancestry creation before an outer saved record', () => {
    state.values = { collection: 'shipments', record: { id: 'outer' } };
    const model = { parent: { use: 'AddNewActionModel', props: { collection: 'shipments' } } };
    expect(renderHook(() => useProcessTarget({ model })).result.current).toEqual({
      status: 'new',
      source: 'create-popup',
    });
  });

  it('uses model ancestry record routes before filter params', () => {
    window.history.replaceState(null, '', '/admin?filterByTk=route');
    const model = { context: { view: { inputArgs: { collectionName: 'shipments', filterByTk: 'model-route' } } } };
    expect(renderHook(() => useProcessTarget({ model, filterByTk: 'filter' })).result.current).toEqual({
      status: 'ready',
      key: 'route',
      source: 'popup-route',
    });
  });

  it('retains the supported metadata fallback when optional NocoBase methods fail', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    state.values = {
      collection: { name: 'shipments', options: { filterTargetKey: 'code' } },
      record: { code: 0, id: 'fallback' },
      manager: {
        getFilterByTK: () => {
          throw new Error('No active collection metadata');
        },
      },
    };
    expect(renderHook(() => useProcessTarget()).result.current).toEqual({
      status: 'ready',
      key: 0,
      source: 'record-context',
    });
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('getFilterByTK'), expect.any(Error));
    debug.mockRestore();
  });
});
