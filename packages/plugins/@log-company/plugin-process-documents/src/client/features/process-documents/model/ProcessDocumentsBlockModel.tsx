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
import { ProcessDocumentsBlock } from '../ui/ProcessDocumentsBlock';

export class ProcessDocumentsBlockModel extends BlockModel {
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
      <ProcessDocumentsBlock
        modelContext={{
          collection: viewInputArgs?.collectionName ?? context.collection,
          record: context.record,
          filterByTk: viewInputArgs?.filterByTk ?? context.filterByTk,
          params: context.params,
          model: this,
        }}
      />
    );
  }
}

ProcessDocumentsBlockModel.define({
  label: 'Документы поставки',
  sort: 547,
});
