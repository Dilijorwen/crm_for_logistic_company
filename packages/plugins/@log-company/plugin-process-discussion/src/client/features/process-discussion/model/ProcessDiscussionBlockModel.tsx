import { BlockModel } from '@nocobase/client';
import React from 'react';
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
  label: 'Обсуждение процесса',
  sort: 545,
});
