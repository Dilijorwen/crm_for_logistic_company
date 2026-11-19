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
import {
  getCollectionName,
  getFlowModelPopupCollectionMode,
  getProcessBlockModelContext,
} from '@log-company/plugin-process-governance/client';
import { ProcessDocumentsBlock } from '../ui/ProcessDocumentsBlock';

export class ProcessDocumentsBlockModel extends BlockModel {
  renderComponent() {
    const context = getProcessBlockModelContext(this, this.context);
    const inputArgs = this.context.view?.inputArgs;
    const collectionName = getCollectionName(context.collection);
    const dataSourceKey = inputArgs?.dataSourceKey ?? this.context.collection?.dataSourceKey ?? 'main';
    const isNew =
      typeof collectionName === 'string' &&
      collectionName !== 'shipments' &&
      getFlowModelPopupCollectionMode(this, collectionName) === 'create';
    return (
      <ProcessDocumentsBlock
        modelContext={isNew ? { ...context, record: null, filterByTk: undefined } : context}
        dataSourceKey={dataSourceKey}
        getCollection={this.getCollection}
        canUpdateField={this.canUpdateField}
      />
    );
  }

  private getCollection = (name: string, dataSourceKey: string) =>
    this.context.dataSourceManager?.getCollection(dataSourceKey, name);

  private canUpdateField = (collection: string, field: string, dataSourceKey: string) =>
    this.context.aclCheck({
      dataSourceKey,
      resourceName: collection,
      actionName: 'update',
      fields: [field],
      allowedActions: null,
    });
}

ProcessDocumentsBlockModel.define({
  label: 'Документы',
  sort: 547,
});
