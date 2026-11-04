/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { AddNewActionModel, BulkDeleteActionModel, DisplayTextFieldModel } from '@nocobase/client';
import { DisplayItemModel } from '@nocobase/flow-engine';
import React from 'react';
import { Space } from 'antd';
import {
  WORKSPACE_RUN_VIEW_UID,
  WORKSPACE_SHIPMENT_VIEW_UID,
  WORKSPACE_CREATE_SHIPMENT_VIEW_UID,
} from '../../../../shared/workspace';
import { openWorkspaceView } from './openWorkspaceView';
import { WorkspaceSharedShipmentBadge } from '../ui/WorkspaceSharedShipmentBadge';
import {
  isWorkspaceDeleteContext,
  recordId,
  workspaceRecordIds,
  workspaceAnchors,
  notifyWorkspaceChanged,
} from '../../../shared/lib';

interface WorkspaceResource {
  getSelectedRows(): unknown[];
  getSourceId?(): unknown;
  setSelectedRows?(rows: unknown[]): void;
  refresh(): Promise<unknown>;
}

function resource(
  model: AddNewActionModel | BulkDeleteActionModel | DisplayTextFieldModel,
): WorkspaceResource | undefined {
  return model.context.blockModel?.resource as unknown as WorkspaceResource | undefined;
}

function defineSource(model: AddNewActionModel | BulkDeleteActionModel, collectionName: string) {
  model.context.defineProperty('resourceName', { get: () => collectionName, cache: false });
}

export class LogisticsWorkspaceNewRunActionModel extends AddNewActionModel {
  static capabilityActionName = 'view';
  onInit(options: unknown) {
    super.onInit(options);
    defineSource(this, 'transport_runs');
  }
  getInputArgs(): Record<string, unknown> {
    return {
      dataSourceKey: 'main',
      collectionName: 'transport_runs',
      filterByTk: null,
      sourceId: null,
      associationName: null,
      workspaceRunId: null,
      workspaceShipmentId: null,
      formData: {},
    };
  }
}
LogisticsWorkspaceNewRunActionModel.define({ label: 'Новый рейс', hide: () => true });

export class LogisticsWorkspaceNewShipmentActionModel extends AddNewActionModel {
  static capabilityActionName = 'view';
  onInit(options: unknown) {
    super.onInit(options);
    defineSource(this, 'shipments');
    const nativeOpenView = this.context.openView;
    this.context.defineMethod('openView', (uid: string, input: Record<string, unknown> = {}) =>
      uid === WORKSPACE_CREATE_SHIPMENT_VIEW_UID ? openWorkspaceView(this, uid, input) : nativeOpenView(uid, input),
    );
  }
  getInputArgs(): Record<string, unknown> {
    const rows: unknown[] = resource(this)?.getSelectedRows() || [];
    const currentRunId =
      workspaceAnchors({ workspaceRunId: resource(this)?.getSourceId?.() }).runId ||
      workspaceAnchors(this.context.view?.inputArgs).runId;
    const ids = new Set(
      currentRunId
        ? [String(currentRunId)]
        : rows.map((row) => workspaceRecordIds(recordId(row))?.runId).filter((id): id is string => Boolean(id)),
    );
    return {
      dataSourceKey: 'main',
      collectionName: 'shipments',
      filterByTk: null,
      sourceId: null,
      associationName: null,
      workspaceRunId: ids.size === 1 ? Array.from(ids)[0] : null,
      workspaceShipmentId: null,
      formData: { runs: Array.from(ids).map((id) => ({ id })) },
    };
  }
}
LogisticsWorkspaceNewShipmentActionModel.define({ label: 'Новая поставка', hide: () => true });

export class LogisticsWorkspaceRecordFieldModel extends DisplayTextFieldModel {
  onInit(options: unknown) {
    super.onInit(options);
    const nativeOpenView = this.context.openView;
    this.context.defineMethod('openView', async (uid: string, input: Record<string, unknown> = {}) => {
      if (![WORKSPACE_RUN_VIEW_UID, WORKSPACE_SHIPMENT_VIEW_UID].includes(uid)) return nativeOpenView(uid, input);
      return openWorkspaceView(this, uid, input);
    });
  }
  onClick(event: unknown) {
    let id = recordId(this.context.record);
    const sourceId = resource(this)?.getSourceId?.();
    if (!workspaceRecordIds(id) && sourceId && id) id = `${sourceId}:${id}`;
    if (!workspaceRecordIds(id)) return;
    const anchors = workspaceRecordIds(id);
    const select = this.context.selectWorkspaceRun as ((runId: string) => void) | undefined;
    if (anchors && typeof select === 'function') select(anchors.runId);
    const shipment = this.context.collectionField?.name === 'shipment_number';
    return this.dispatchEvent(
      'click',
      {
        event,
        filterByTk: shipment ? anchors?.shipmentId : id,
        sourceId: null,
        associationName: null,
        dataSourceKey: 'main',
        collectionName: shipment ? 'shipments' : 'logistics_work_items',
        navigation: false,
        workspaceRunId: anchors?.runId,
        workspaceShipmentId: anchors?.shipmentId,
        tabUid: shipment ? 'lcwsshipmentfulltab' : 'lcwsruntab',
      },
      { debounce: false, useCache: false },
    );
  }

  renderComponent(value?: unknown, wrap?: boolean) {
    const shipment = this.context.collectionField?.name === 'shipment_number';
    const text = shipment && value != null && !this.props.prefix ? `№${value}` : value;
    const rendered = super.renderComponent(text, wrap);
    if (this.context.collectionField?.name !== 'shipment_number') return rendered;
    const current = workspaceRecordIds(recordId(this.context.record));
    const shipmentId =
      current?.shipmentId || (recordId(this.context.record) ? String(recordId(this.context.record)) : null);
    return shipmentId ? (
      <Space size={4}>
        {rendered}
        <WorkspaceSharedShipmentBadge host={this} shipmentId={shipmentId} />
      </Space>
    ) : (
      rendered
    );
  }
}
LogisticsWorkspaceRecordFieldModel.define({ label: 'Рейс и поставка: всплывающее окно' });
DisplayItemModel.bindModelToInterface(
  'LogisticsWorkspaceRecordFieldModel',
  ['input', 'textarea', 'integer', 'number'],
  { isDefault: false },
);

export class LogisticsWorkspaceBulkDeleteActionModel extends BulkDeleteActionModel {
  static capabilityActionName = 'view';
  onInit(options: unknown) {
    super.onInit(options);
    defineSource(this, 'shipments');
  }
}
LogisticsWorkspaceBulkDeleteActionModel.define({ label: 'Удалить', hide: (ctx) => !isWorkspaceDeleteContext(ctx) });
LogisticsWorkspaceBulkDeleteActionModel.registerFlow({
  key: 'deleteSettings',
  title: 'Настройки удаления',
  on: 'click',
  steps: {
    confirm: {
      use: 'confirm',
      defaultParams: {
        enable: true,
        title: 'Удалить выбранные поставки?',
        content:
          'Поставки удалятся целиком из всех рейсов. Рейсы, в которых после этого не останется поставок, тоже удалятся.',
      },
    },
    delete: {
      async handler(ctx) {
        const current = resource(ctx.model as LogisticsWorkspaceBulkDeleteActionModel);
        const runId = workspaceAnchors({
          ...ctx.view?.inputArgs,
          workspaceRunId: current?.getSourceId?.() || ctx.view?.inputArgs?.workspaceRunId,
        }).runId;
        const selection = new Map<string, string>();
        for (const row of current?.getSelectedRows() || []) {
          const id = recordId(row);
          const key = workspaceRecordIds(id)
            ? String(id)
            : runId && /^[1-9]\d*$/.test(String(id))
              ? `${runId}:${id}`
              : '';
          const shipmentId = workspaceRecordIds(key)?.shipmentId;
          if (shipmentId) selection.set(shipmentId, key);
        }
        const keys = [...selection.values()];
        if (!keys.length) {
          ctx.message.warning('Выберите строки с поставками.');
          return;
        }
        const refreshEngine = ctx.model.flowEngine.previousEngine || ctx.model.flowEngine;
        const response = await ctx.api.resource('logisticsWorkspace').destroyShipments({ values: { rowIds: keys } });
        current?.setSelectedRows?.([]);
        const deleted = response.data?.data as { runIds?: string[] } | undefined;
        if (runId && deleted?.runIds?.includes(runId) && ctx.view?.type === 'dialog')
          await ctx.view.close?.(undefined, true);
        else await current?.refresh();
        notifyWorkspaceChanged(refreshEngine);
        ctx.message.success('Выбранные поставки и опустевшие рейсы удалены.');
      },
    },
  },
});
