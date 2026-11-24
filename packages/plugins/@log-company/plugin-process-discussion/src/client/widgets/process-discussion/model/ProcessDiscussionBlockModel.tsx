/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { BlockModel } from '@nocobase/client';
import React from 'react';
import { getProcessBlockModelContext, workspaceAnchors } from '@log-company/plugin-process-governance/client';
import { ProcessDiscussionBlock } from '../ui/ProcessDiscussionBlock';

export class ProcessDiscussionBlockModel extends BlockModel {
  renderComponent() {
    const modelContext = getProcessBlockModelContext(this, this.context);
    const shared = this.props?.workspaceDiscussion;
    const anchors = shared ? workspaceAnchors(this.context.view?.inputArgs) : undefined;
    const workspace =
      shared === 'run' && anchors?.runId
        ? { entity: 'run' as const, id: anchors.runId }
        : shared === 'shipment' && anchors?.shipmentId
          ? { entity: 'shipment' as const, id: anchors.shipmentId }
          : undefined;
    return <ProcessDiscussionBlock modelContext={modelContext} workspace={workspace} />;
  }
}

ProcessDiscussionBlockModel.define({
  label: 'Обсуждение поставки',
  sort: 545,
});
