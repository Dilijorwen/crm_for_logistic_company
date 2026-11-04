/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { FlowModelRenderer, type FlowModel } from '@nocobase/flow-engine';
import type { TableBlockModel } from '@nocobase/client';
import React, { useEffect, useState } from 'react';
import type { WorkspaceViewHost } from '../../../shared/lib';

/** The sidebar renders the same native association action as the shipments table. */
export function WorkspaceShipmentDetachButton({
  host,
  runId,
  shipmentId,
}: {
  host: WorkspaceViewHost;
  runId: string;
  shipmentId: string;
}) {
  const [action, setAction] = useState<FlowModel>();
  useEffect(() => {
    const table = host.flowEngine.createModel({
      use: 'TableBlockModel',
      stepParams: {
        resourceSettings: {
          init: {
            dataSourceKey: 'main',
            collectionName: 'shipments',
            associationName: 'transport_runs.shipments',
            sourceId: runId,
          },
        },
      },
    }) as unknown as TableBlockModel;
    table.resource.setSourceId(runId);
    const action = table.addSubModel('actions', { use: 'LogisticsWorkspaceDisassociateActionModel' });
    action.context.defineProperty('record', { value: { id: shipmentId } });
    setAction(action as FlowModel);
    return () => {
      host.flowEngine.removeModelWithSubModels(table.uid);
    };
  }, [host, runId, shipmentId]);
  return action ? <FlowModelRenderer model={action} showFlowSettings={false} /> : null;
}
