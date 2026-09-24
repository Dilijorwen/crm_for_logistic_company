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
import { RunTreeBlock } from './RunTreeBlock';

export class RunTreeBlockModel extends BlockModel {
  renderComponent() {
    const context = this.context as unknown as {
      collection?: unknown;
      record?: Record<string, unknown> | null;
      filterByTk?: unknown;
      params?: Record<string, unknown>;
      view?: {
        inputArgs?: {
          collectionName?: string;
          filterByTk?: unknown;
        };
      };
    };
    const viewInputArgs = context.view?.inputArgs;

    return (
      <RunTreeBlock
        entityKind="run"
        modelContext={{
          collection: viewInputArgs?.collectionName ?? context.collection,
          record: context.record,
          filterByTk: viewInputArgs?.filterByTk ?? context.filterByTk,
          params: context.params,
        }}
      />
    );
  }
}

RunTreeBlockModel.define({
  label: 'Дерево рейсов',
  sort: 547,
});
