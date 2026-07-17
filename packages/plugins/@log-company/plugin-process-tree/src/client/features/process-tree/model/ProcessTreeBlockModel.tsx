import { BlockModel } from '@nocobase/client';
import React from 'react';
import { ProcessTreeBlock } from '../ui/ProcessTreeBlock';

export class ProcessTreeBlockModel extends BlockModel {
  renderComponent() {
    const context = this.context as unknown as {
      collection?: unknown;
      record?: Record<string, unknown> | null;
      filterByTk?: unknown;
      params?: Record<string, unknown>;
    };

    return (
      <ProcessTreeBlock
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

ProcessTreeBlockModel.define({
  label: 'Дерево процессов',
  sort: 546,
});
