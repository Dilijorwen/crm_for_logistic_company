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
  type CreateModelOptions,
} from '@nocobase/flow-engine';
import { Alert, Skeleton, type FormInstance } from 'antd';
import React, { useEffect, useState } from 'react';
import type { WorkspaceViewHost } from '../../../shared/lib';

/** Isolates native form/view instances, never changing the parent engine's context. */
export function ScopedNativeBlock({
  host,
  templateUid,
  runId,
  shipmentId,
  shipmentDraft,
}: {
  host: WorkspaceViewHost;
  templateUid: string;
} & (
  | { runId: string; shipmentId?: never; shipmentDraft?: never }
  | { runId?: never; shipmentId: string; shipmentDraft?: never }
  | {
      runId?: never;
      shipmentId?: never;
      shipmentDraft: { form: FormInstance; companyPath(): (string | number)[]; setTokens(tokens: string[]): void };
    }
)) {
  const [content, setContent] = useState<React.ReactNode>(<Skeleton active />);
  useEffect(() => {
    let active = true;
    const id = shipmentId ?? runId;
    const collectionName = shipmentId || shipmentDraft ? 'shipments' : 'transport_runs';
    setContent(<Skeleton active />);
    const engine = createBlockScopedEngine(host.flowEngine);
    const context = new FlowContext();
    context.addDelegate(host.context);
    context.defineProperty('engine', { value: engine });
    context.defineProperty('view', {
      value: {
        type: 'block',
        inputArgs: {
          dataSourceKey: 'main',
          collectionName,
          filterByTk: id,
          workspaceRunId: runId ?? null,
          workspaceShipmentId: shipmentId ?? null,
          workspaceShipmentDraft: shipmentDraft,
          sourceId: null,
          associationName: null,
        },
      },
    });
    context.defineProperty('record', { value: { id } });
    context.defineProperty('collection', {
      get: () => host.context.dataSourceManager.getCollection('main', collectionName),
    });
    async function load() {
      try {
        const options = await engine.modelRepository?.findOne({ uid: templateUid });
        if (!options || typeof options.use !== 'string') throw new Error('Не настроен блок рабочего списка');
        const model = engine.createModel(options as CreateModelOptions, { delegateToParent: false, delegate: context });
        if (active)
          setContent(
            <FlowEngineProvider engine={engine}>
              <FlowViewContextProvider context={context}>
                <FlowModelRenderer model={model} showFlowSettings={false} />
              </FlowViewContextProvider>
            </FlowEngineProvider>,
          );
      } catch (error) {
        console.error('Не удалось загрузить блок рабочего списка.', error);
        if (active) setContent(<Alert type="error" showIcon message="Не удалось загрузить сведения." />);
      }
    }
    load();
    return () => {
      active = false;
      engine.unlinkFromStack();
    };
  }, [host, templateUid, runId, shipmentId, shipmentDraft]);
  return <>{content}</>;
}
