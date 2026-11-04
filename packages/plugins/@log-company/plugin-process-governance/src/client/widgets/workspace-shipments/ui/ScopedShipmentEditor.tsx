/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  createBlockScopedEngine,
  FlowContext,
  FlowEngineProvider,
  FlowModelRenderer,
  FlowViewContextProvider,
  type FlowEngine,
  type FlowModel,
  type CreateModelOptions,
} from '@nocobase/flow-engine';
import { Alert, Skeleton } from 'antd';
import React, { useEffect, useState } from 'react';

export function ScopedShipmentEditor({
  host,
  shipmentId,
  runId,
  onReady,
}: {
  host: FlowModel;
  shipmentId: string;
  runId: string;
  onReady(engine?: FlowEngine): void;
}) {
  const [state, setState] = useState<{
    engine?: FlowEngine;
    context?: FlowContext;
    model?: FlowModel;
    error?: boolean;
  }>({});
  useEffect(() => {
    let active = true;
    const engine = createBlockScopedEngine(host.flowEngine);
    // NocoBase's scoped proxy can expose the parent engine context. Never mutate it.
    const context = new FlowContext();
    context.addDelegate(host.context);
    context.defineProperty('engine', { value: engine });
    const outerView = host.context.view;
    context.defineProperty('view', {
      value: Object.assign(Object.create(outerView || null), {
        navigation: undefined,
        inputArgs: {
          ...outerView?.inputArgs,
          collectionName: 'shipments',
          filterByTk: shipmentId,
          workspaceShipmentId: shipmentId,
          workspaceRunId: runId,
          sourceId: null,
          associationName: null,
          tabUid: undefined,
        },
      }),
    });
    async function load() {
      try {
        const template = host.subModels?.editor as FlowModel;
        if (!template) throw new Error('Shipment editor template is not configured');
        const options = (await engine.modelRepository?.findOne({ uid: template.uid })) || template.serialize();
        if (!active) return;
        if (typeof options.use !== 'string') throw new Error('Invalid shipment editor template');
        const model = engine.createModel(options as CreateModelOptions, {
          delegateToParent: false,
          delegate: context,
        });
        onReady(engine);
        setState({ engine, context, model });
      } catch (error) {
        console.error('Не удалось открыть редактор поставки.', error);
        if (active) setState({ error: true });
      }
    }
    load();
    return () => {
      active = false;
      onReady(undefined);
      engine.unlinkFromStack();
    };
  }, [host, shipmentId, runId, onReady]);
  if (state.error)
    return <Alert type="error" message="Не удалось загрузить выбранную поставку. Откройте её повторно." showIcon />;
  if (!state.engine || !state.context || !state.model) return <Skeleton active />;
  return (
    <FlowEngineProvider engine={state.engine}>
      <FlowViewContextProvider context={state.context}>
        <FlowModelRenderer model={state.model} showFlowSettings={false} />
      </FlowViewContextProvider>
    </FlowEngineProvider>
  );
}
