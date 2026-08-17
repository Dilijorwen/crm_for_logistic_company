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
import { tExpr } from '../../../locale';
import { ProcessDiscussionBlock } from '../ui/ProcessDiscussionBlock';

export class ProcessDiscussionBlockModel extends BlockModel {
  renderComponent() {
    const context = this.context as unknown as {
      collection?: unknown;
      record?: Record<string, unknown> | null;
      filterByTk?: unknown;
      params?: Record<string, unknown>;
    };

    return (
      <ProcessDiscussionBlock
        modelContext={{
          collection: context.collection,
          record: context.record,
          filterByTk: context.filterByTk,
          params: context.params,
        }}
      />
    );
  }
}

ProcessDiscussionBlockModel.define({
  label: tExpr('discussion.blockTitle'),
  sort: 545,
});
