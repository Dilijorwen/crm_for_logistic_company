/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type React from 'react';
import { CreateFormModel, EditFormModel } from '@nocobase/client';
import { SingleRecordResource } from '@nocobase/flow-engine';
import { describe, expect, it, vi } from 'vitest';

const { define } = vi.hoisted(() => ({ define: vi.fn() }));

vi.mock('@nocobase/client', () => {
  class BlockModel {
    context: unknown;
  }
  Object.assign(BlockModel, { define, registerFlow: vi.fn() });
  return { BlockModel, CreateFormModel: class {}, EditFormModel: class {} };
});

vi.mock('@log-company/plugin-process-governance/client', async () => {
  return {
    ...(await import(
      '../../../../../../../plugin-process-governance/src/client/shared/lib/process-context/blockModelContext'
    )),
    ...(await import(
      '../../../../../../../plugin-process-governance/src/client/shared/lib/process-context/getFlowModelPopupCollectionMode'
    )),
    ...(await import(
      '../../../../../../../plugin-process-governance/src/client/shared/lib/process-context/recordContext'
    )),
  };
});

vi.mock('../../ui/ProcessDocumentsBlock', () => ({
  ProcessDocumentsBlock: () => null,
}));

vi.mock('../../ui/FormFolderUpload', () => ({ WorkspaceShipmentDraftUpload: () => null }));

import { ProcessDocumentsBlockModel } from '../ProcessDocumentsBlockModel';

interface DocumentsElementProps {
  folderMode?: 'view' | 'upload';
  shipmentId?: string | number;
  findForm: () => { model: unknown; resource: SingleRecordResource } | undefined;
  modelContext: {
    collection?: unknown;
    record?: Record<string, unknown> | null;
    filterByTk?: unknown;
    params?: Record<string, unknown>;
    model?: unknown;
  };
}

function renderModel(
  context: unknown,
  options?: { parent?: unknown; props?: object; models?: unknown[] },
): DocumentsElementProps {
  const instance = Object.assign(new ProcessDocumentsBlockModel(), {
    context,
    parent: options?.parent,
    props: options?.props,
    flowEngine: { forEachModel: (callback: (model: unknown) => void) => options?.models?.forEach(callback) },
  });
  return (instance.renderComponent() as React.ReactElement<DocumentsElementProps>).props;
}

function form(collection: string, create: boolean, view?: unknown, recordId = '24', parent?: unknown) {
  const resource = Object.assign(Object.create(SingleRecordResource.prototype), {
    getResourceName: () => collection,
    getDataSourceKey: () => 'main',
    getMeta: () => undefined,
    getFilterByTk: () => (create ? undefined : recordId),
    isNewRecord: create,
  });
  return Object.assign(
    create ? new CreateFormModel({ use: 'CreateFormModel' }) : new EditFormModel({ use: 'EditFormModel' }),
    {
      context: { resource, view },
      parent,
    },
  );
}

describe('ProcessDocumentsBlockModel', () => {
  it('registers a readable Russian label without a translation key', () => {
    expect(define).toHaveBeenCalledWith({
      label: 'Документы',
      sort: 547,
    });
  });

  it('uses the current shipment popup arguments instead of the outer run context', () => {
    const props = renderModel({
      collection: { name: 'transport_runs' },
      filterByTk: 'run-17',
      view: { inputArgs: { collectionName: 'shipments', filterByTk: 'shipment-42' } },
    });

    expect(props.modelContext).toMatchObject({
      collection: 'shipments',
      filterByTk: 'shipment-42',
    });
  });

  it('opens the saved shipment in a run tab without binding to the run form', () => {
    const props = renderModel(
      {
        collection: 'transport_runs',
        filterByTk: 'run-17',
        view: {
          type: 'block',
          inputArgs: { collectionName: 'shipments', filterByTk: '42', workspaceShipmentId: '42' },
        },
      },
      { props: { folderMode: 'upload' } },
    );

    expect(props.shipmentId).toBe('42');
    expect(props.findForm).toBeUndefined();
  });

  it('uses the run form and run ID rather than the composite key of the workspace row', () => {
    const owner = form('transport_runs', false);
    const props = renderModel(
      {
        view: { inputArgs: { collectionName: 'logistics_work_items', filterByTk: '24:42', workspaceRunId: '24' } },
      },
      { parent: { parent: owner }, props: { folderMode: 'upload' } },
    );

    expect(props.modelContext).toMatchObject({ collection: 'transport_runs', filterByTk: '24' });
    expect(props.findForm()?.model).toBe(owner);
  });

  it('ignores the outer record in a new permit form', () => {
    const props = renderModel({
      collection: { name: 'our_companies' },
      record: { id: '10' },
      filterByTk: '10',
      view: { inputArgs: { collectionName: 'permit_documents' } },
    });
    expect(props.modelContext).toMatchObject({
      collection: 'permit_documents',
      record: null,
      filterByTk: undefined,
    });
  });

  it.each(['transport_runs', 'shipments', 'contracts', 'permit_documents', 'our_companies'])(
    'uses the draft uploader in a new %s form even when the grid recreates its view context',
    (collectionName) => {
      const owner = form(collectionName, true, { inputArgs: { collectionName } });
      const props = renderModel(
        { collection: 'shipments', record: { id: '61' }, view: { inputArgs: { collectionName } } },
        { parent: { parent: owner } },
      );
      expect(props.folderMode).toBe('upload');
      expect(props.modelContext.record).toBeNull();
      expect(props.findForm()?.model).toBe(owner);
    },
  );

  it('binds a neighboring edit form for the current collection but keeps explicit view mode', () => {
    const view = { inputArgs: { collectionName: 'contracts', filterByTk: '24' } };
    const own = form('contracts', false, view);
    const other = form('our_companies', false, view);
    const context = { view };
    const props = renderModel(context, { models: [other, own] });
    expect(props.folderMode).toBe('upload');
    expect(props.findForm()?.model).toBe(own);
    expect(renderModel(context, { models: [own], props: { folderMode: 'view' } }).folderMode).toBe('view');
  });

  it('finds the neighboring permit form with a separate copy of the popup context', () => {
    const args = { viewUid: 'edit-permit', collectionName: 'permit_documents', filterByTk: '24' };
    const parent = { uid: 'permit-grid', parent: { uid: 'edit-tab', subKey: 'tabs' } };
    const owner = form('permit_documents', false, { type: 'embed', inputArgs: { ...args } }, '24', parent);
    const props = renderModel(
      { view: { type: 'embed', inputArgs: { ...args, filterByTk: 24 } } },
      { parent, models: [owner] },
    );
    expect(props.findForm()?.model).toBe(owner);
    expect(props.folderMode).toBe('upload');
  });

  it('never binds a different record, a creation form or a form in another tab', () => {
    const view = {
      type: 'embed',
      inputArgs: { viewUid: 'edit-permit', collectionName: 'permit_documents', filterByTk: '24' },
    };
    const parent = { uid: 'permit-grid', parent: { uid: 'edit-tab', subKey: 'tabs' } };
    const otherParent = { uid: 'other-grid', parent: { uid: 'other-tab', subKey: 'tabs' } };
    const wrongRow = form('permit_documents', false, view, '25', parent);
    const wrongTab = form('permit_documents', false, view, '24', otherParent);
    const creation = form('permit_documents', true, view, '24', parent);
    for (const candidate of [wrongRow, wrongTab, creation]) {
      expect(renderModel({ view }, { parent, models: [candidate] }).findForm()).toBeUndefined();
    }
  });

  it('does not choose between two forms editing the same record in the same tab', () => {
    const args = { viewUid: 'edit-permit', collectionName: 'permit_documents', filterByTk: '24' };
    const parent = { uid: 'permit-grid', parent: { uid: 'edit-tab', subKey: 'tabs' } };
    const exact = form('permit_documents', false, { inputArgs: args }, '24', parent);
    const copied = form('permit_documents', false, { inputArgs: { ...args } }, '24', parent);
    expect(renderModel({ view: { inputArgs: args } }, { parent, models: [exact, copied] }).findForm()).toBeUndefined();
  });
});
