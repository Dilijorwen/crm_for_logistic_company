/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { BlockModel, CreateFormModel, EditFormModel } from '@nocobase/client';
import { SingleRecordResource, type FlowModel } from '@nocobase/flow-engine';
import React from 'react';
import {
  getCollectionName,
  getFlowModelPopupCollectionMode,
  getProcessBlockModelContext,
} from '@log-company/plugin-process-governance/client';
import { documentRecordId, isDocumentFormResource } from '../../../../contracts/processDocuments';
import { ProcessDocumentsBlock } from '../ui/ProcessDocumentsBlock';
import type { DocumentFormBinding } from '../ui/FormFolderUpload';

export class ProcessDocumentsBlockModel extends BlockModel {
  renderComponent() {
    const view: { type?: string; inputArgs?: Record<string, unknown> } | undefined = this.context.view;
    const inputArgs = view?.inputArgs;
    const dataSourceKey =
      typeof inputArgs?.dataSourceKey === 'string'
        ? inputArgs.dataSourceKey
        : this.context.collection?.dataSourceKey ?? 'main';
    const configuredMode = this.props?.folderMode;
    const scopedShipmentId = view?.type === 'block' ? documentRecordId(inputArgs?.workspaceShipmentId) : undefined;
    if (scopedShipmentId) {
      return (
        <ProcessDocumentsBlock
          shipmentId={scopedShipmentId}
          dataSourceKey={dataSourceKey}
          folderMode={configuredMode === 'view' ? 'view' : undefined}
        />
      );
    }

    const context = getProcessBlockModelContext(this, this.context);
    const runId = documentRecordId(inputArgs?.workspaceRunId);
    // The popup is opened on a grouped table row, while its native form saves the run itself.
    const runForm =
      runId && getCollectionName(context.collection) === 'logistics_work_items'
        ? this.findForm('transport_runs')
        : undefined;
    const recordContext = runForm ? { ...context, collection: 'transport_runs', filterByTk: runId } : context;
    const collectionName = getCollectionName(recordContext.collection);
    const binding = runForm ?? (isDocumentFormResource(collectionName) ? this.findForm(collectionName) : undefined);
    const mode =
      configuredMode === 'view' || configuredMode === 'upload' ? configuredMode : binding ? 'upload' : undefined;
    const isNew =
      binding?.resource.isNewRecord ??
      (typeof collectionName === 'string' &&
        (collectionName !== 'shipments' || mode !== undefined) &&
        getFlowModelPopupCollectionMode(this, collectionName) === 'create');
    return (
      <ProcessDocumentsBlock
        modelContext={isNew ? { ...recordContext, record: null, filterByTk: undefined } : recordContext}
        dataSourceKey={dataSourceKey}
        getCollection={this.getCollection}
        canUpdateField={this.canUpdateField}
        folderMode={mode}
        findForm={isDocumentFormResource(collectionName) ? () => this.findForm(collectionName) : undefined}
      />
    );
  }

  private findForm(collectionName: string): DocumentFormBinding | undefined {
    function bind(model: FlowModel): DocumentFormBinding | undefined {
      if (!(model instanceof CreateFormModel || model instanceof EditFormModel)) return;
      const resource = model.context.resource;
      if (
        resource instanceof SingleRecordResource &&
        resource.getResourceName() === collectionName &&
        (resource.getDataSourceKey() || 'main') === 'main'
      ) {
        return { model, resource };
      }
    }

    // A form grid may expose an equivalent but freshly created view on each access.
    for (let parent = this.parent; parent; parent = parent.parent) {
      if (parent instanceof CreateFormModel || parent instanceof EditFormModel) return bind(parent);
    }
    const view = this.context.view;
    if (!view) return;
    const matches: DocumentFormBinding[] = [];
    this.flowEngine.forEachModel((model) => {
      const form = bind(model);
      if (!form) return;
      const formView = model.context.view;
      if (formView === view || (view.inputArgs && formView?.inputArgs === view.inputArgs)) matches.push(form);
    });
    return matches.length === 1 ? matches[0] : undefined;
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

ProcessDocumentsBlockModel.registerFlow({
  key: 'documentFolderSettings',
  title: 'Режим документов',
  steps: {
    folder: {
      title: 'Режим',
      uiSchema: {
        mode: {
          type: 'string',
          title: 'Режим',
          'x-decorator': 'FormItem',
          'x-component': 'Select',
          'x-component-props': { allowClear: true },
          enum: [
            { value: 'view', label: 'Просмотр' },
            { value: 'upload', label: 'Загрузка' },
          ],
        },
      },
      defaultParams: (ctx) => ({
        mode: ctx.model.props.folderMode,
      }),
      handler(ctx, params) {
        ctx.model.setProps('folderMode', params.mode);
      },
    },
  },
});
