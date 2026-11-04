/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { BlockModel } from '@nocobase/client';
import { DATA_SOURCE_DIRTY_EVENT, FlowModelRenderer, type FlowModel, type FlowEngine } from '@nocobase/flow-engine';
import { Empty } from 'antd';
import React from 'react';
import { workspaceAnchors } from '../../../shared/lib';
import { WorkspaceRecordHeader } from '../../../features/workspace-record-header';

interface WorkspaceView {
  inputArgs?: Record<string, unknown>;
}

/** Gives native forms, documents, discussion and the run tree their real source context. */
export class LogisticsWorkspaceContextBlockModel extends BlockModel {
  private workspaceView?: WorkspaceView;

  onInit(options: unknown) {
    super.onInit(options);
    this.workspaceView = this.context.view as WorkspaceView;
    this.context.defineProperty('view', {
      cache: false,
      get: () => {
        const view = this.props.isolated
          ? this.workspaceView
          : (this.parent?.context.view as WorkspaceView) || this.workspaceView;
        const args = view?.inputArgs || {};
        const ids = workspaceAnchors(args);
        const collectionName = this.props.entity === 'run' ? 'transport_runs' : 'shipments';
        const filterByTk = this.props.creation ? null : this.props.entity === 'run' ? ids?.runId : ids?.shipmentId;
        return Object.assign(Object.create(view || null), {
          inputArgs: {
            ...args,
            workspaceRunId: ids.runId,
            workspaceShipmentId: ids.shipmentId,
            collectionName,
            filterByTk,
            associationName: null,
            sourceId: null,
          },
        });
      },
    });
    this.context.defineProperty('disableBlockGridPadding', { value: true });
    this.context.defineProperty('record', {
      cache: false,
      get: () => {
        const id = (this.context.view as WorkspaceView)?.inputArgs?.filterByTk;
        return id ? { id } : undefined;
      },
    });
  }

  renderComponent() {
    const view = this.props.isolated
      ? this.workspaceView
      : (this.parent?.context.view as WorkspaceView) || this.workspaceView;
    const ids = workspaceAnchors(view?.inputArgs);
    const sourceId = this.props.entity === 'run' ? ids?.runId : ids?.shipmentId;
    if (!this.props.creation && !sourceId && !this.context.flowSettingsEnabled) {
      return (
        <Empty
          description={
            this.props.entity === 'run'
              ? 'Не удалось определить рейс. Закройте окно и откройте его заново из рабочего списка.'
              : 'В этой строке ещё нет поставки. Добавьте или привяжите её на вкладке «Рейс».'
          }
        />
      );
    }
    return (
      <>
        {!this.props.creation && sourceId ? (
          <WorkspaceRecordHeader
            context={this.context}
            entity={this.props.entity === 'run' ? 'run' : 'shipment'}
            recordId={sourceId}
          />
        ) : null}
        <FlowModelRenderer model={this.subModels?.grid as FlowModel} showFlowSettings={false} />
      </>
    );
  }

  onMount() {
    super.onMount();
    this.flowEngine.emitter.on(DATA_SOURCE_DIRTY_EVENT, this.refreshWorkspace);
  }

  onUnmount() {
    this.flowEngine.emitter.off(DATA_SOURCE_DIRTY_EVENT, this.refreshWorkspace);
    super.onUnmount();
  }

  private readonly refreshWorkspace = async (): Promise<void> => {
    let engine: FlowEngine | undefined = this.flowEngine;
    const visited = new Set<FlowEngine>();
    const resources = new Set<{ refresh(): Promise<unknown> }>();
    while (engine && !visited.has(engine)) {
      visited.add(engine);
      engine.forEachModel((model) => {
        const candidate = model as FlowModel & {
          getResourceSettingsInitParams?: () => { collectionName?: string };
          resource?: { refresh(): Promise<unknown> };
        };
        if (
          candidate.getResourceSettingsInitParams?.().collectionName === 'logistics_work_items' &&
          candidate.resource
        ) {
          resources.add(candidate.resource);
        }
      });
      engine = engine.previousEngine;
    }
    const results = await Promise.allSettled(Array.from(resources, (current) => current.refresh()));
    if (results.some((result) => result.status === 'rejected')) {
      this.context.message.warning('Изменения сохранены, но рабочий список не обновился. Обновите страницу.');
    }
  };
}

LogisticsWorkspaceContextBlockModel.define({
  label: 'Контекст рейса или поставки',
  createModelOptions: {
    use: 'LogisticsWorkspaceContextBlockModel',
    props: { entity: 'shipment' },
    subModels: { grid: { use: 'BlockGridModel' } },
  },
});
LogisticsWorkspaceContextBlockModel.registerFlow({
  key: 'workspaceSourceSettings',
  title: 'Источник данных',
  steps: {
    source: {
      title: 'Рейс или поставка',
      uiSchema: {
        entity: {
          type: 'string',
          title: 'Источник',
          'x-decorator': 'FormItem',
          'x-component': 'Select',
          enum: [
            { value: 'run', label: 'Рейс' },
            { value: 'shipment', label: 'Поставка' },
          ],
        },
      },
      defaultParams: (ctx) => ({ entity: ctx.model.props.entity || 'shipment' }),
      handler(ctx, params) {
        ctx.model.setProps('entity', params.entity);
      },
    },
  },
});

/** A native, designer-editable tabbed page embedded as a reusable block. */
export class LogisticsWorkspaceTabsBlockModel extends BlockModel {
  onInit(options: unknown) {
    super.onInit(options);
    const outerView = this.context.view as WorkspaceView;
    this.context.defineProperty('view', {
      cache: false,
      get: () => {
        const view = (this.parent?.context.view as WorkspaceView) || outerView;
        // A nested page must not reuse the outer page's active tab or route navigation.
        return Object.assign(Object.create(view || null), {
          navigation: undefined,
          inputArgs: { ...view?.inputArgs, tabUid: undefined },
        });
      },
    });
  }
  renderComponent() {
    return <FlowModelRenderer model={this.subModels?.page as FlowModel} showFlowSettings={true} />;
  }
}
LogisticsWorkspaceTabsBlockModel.define({
  label: 'Вкладки поставки',
  createModelOptions: { use: 'LogisticsWorkspaceTabsBlockModel', subModels: { page: { use: 'ChildPageModel' } } },
});
