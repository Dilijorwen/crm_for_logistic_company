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
    };

    return (
      <ProcessDocumentsBlock
        modelContext={{
          collection: context.collection,
          record: context.record,
          filterByTk: context.filterByTk,
          params: context.params,
          model: this,
        }}
      />
    );
  }
}

ProcessDocumentsBlockModel.define({
  label: 'Документы процесса',
  sort: 547,
});
