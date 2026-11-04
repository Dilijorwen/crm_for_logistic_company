/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { FlowPage, PopupActionModel, openViewFlow } from '@nocobase/client';
import React from 'react';
import { WORKSPACE_RUN_VIEW_UID, WORKSPACE_CREATE_SHIPMENT_VIEW_UID } from '../../../../shared/workspace';
import { workspaceAnchors } from '../../../shared/lib';
import { WorkspaceFlowPage } from '../ui/WorkspaceFlowPage';

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Resolve serializable native route parameters into the source form's context. */
export class LogisticsWorkspacePopupActionModel extends PopupActionModel {}
LogisticsWorkspacePopupActionModel.define({ ...PopupActionModel.meta, label: 'Карточка рейса или поставки' });
LogisticsWorkspacePopupActionModel.registerFlow({
  ...openViewFlow,
  steps: {
    resolve: {
      async handler(ctx) {
        const viewer = ctx.viewer;
        ctx.defineProperty('viewer', {
          value: new Proxy(viewer, {
            get(target, property) {
              if (property !== 'open') return Reflect.get(target, property, target);
              return (options: Parameters<typeof viewer.open>[0]) =>
                viewer.open({
                  ...options,
                  content: (view) => {
                    const content = typeof options.content === 'function' ? options.content(view) : options.content;
                    return React.isValidElement<React.ComponentProps<typeof WorkspaceFlowPage>>(content) &&
                      content.type === FlowPage
                      ? React.createElement(WorkspaceFlowPage, content.props)
                      : content;
                  },
                });
            },
          }),
        });
        const args = ctx.inputArgs;
        const isRun = ctx.model.uid === WORKSPACE_RUN_VIEW_UID;
        const isCreate = ctx.model.uid === WORKSPACE_CREATE_SHIPMENT_VIEW_UID;
        if (isCreate) {
          args.mode = 'dialog';
          args.size = 'large';
        }
        const anchor = workspaceAnchors({ ...args, workspaceRunId: isRun ? args.workspaceRunId : args.sourceId });
        args.workspaceRunId = anchor.runId;
        args.workspaceShipmentId = isRun || isCreate ? null : anchor.shipmentId;
        args.sourceId = null;
        args.associationName = null;
        if (isCreate) args.formData = { ...object(args.formData), runs: [{ id: anchor.runId }] };
        const stack = args.navigation?.viewStack || [];
        const opener = stack[stack.length - 2];
        args.workspaceReturnToRun = !isRun && opener?.viewUid === WORKSPACE_RUN_VIEW_UID;
      },
    },
    ...openViewFlow.steps,
  },
});
