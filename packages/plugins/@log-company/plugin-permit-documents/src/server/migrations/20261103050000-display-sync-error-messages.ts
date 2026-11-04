/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import type { Model, Transaction } from '@nocobase/database';

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export default class DisplaySyncErrorMessages extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.db.sequelize.transaction(async (transaction) => {
      const field = await this.db
        .getRepository('fields')
        .findOne({ filter: { collectionName: 'permit_documents', name: 'last_sync_error' }, transaction });
      if (field) {
        const options = object(field.get('options'));
        await field.update(
          {
            options: {
              ...options,
              uiSchema: { ...object(options.uiSchema), 'x-component': 'PermitDocumentSyncError' },
            },
          },
          { transaction },
        );
      }
      if (!this.db.getCollection('flowModels')) return;
      const repository = this.db.getRepository('flowModels');
      const models: Model[] = await repository.find({ transaction });
      const paths: Model[] = await this.db
        .getRepository('flowModelTreePath')
        .find({ filter: { depth: 1 }, transaction });
      const parents = new Map(paths.map((path) => [String(path.get('descendant')), String(path.get('ancestor'))]));
      const update = repository as unknown as {
        upsertModel(options: Record<string, unknown>, context: { transaction: Transaction }): Promise<unknown>;
      };
      for (const model of models) {
        const options = object(model.get('options'));
        const stepParams = object(options.stepParams);
        const init = object(object(stepParams.fieldSettings).init);
        if (init.collectionName !== 'permit_documents' || init.fieldPath !== 'last_sync_error') continue;
        const settingsKey =
          options.use === 'DetailsItemModel'
            ? 'detailItemSettings'
            : options.use === 'TableColumnModel'
              ? 'tableColumnSettings'
              : null;
        if (!settingsKey) continue;
        const settings = object(stepParams[settingsKey]);
        const binding = object(settings.model);
        if (
          binding.use &&
          !['DisplayTextFieldModel', 'PermitDocumentSyncErrorFieldModel'].includes(String(binding.use))
        )
          continue;
        await update.upsertModel(
          {
            uid: model.get('uid'),
            stepParams: {
              ...stepParams,
              [settingsKey]: { ...settings, model: { ...binding, use: 'PermitDocumentSyncErrorFieldModel' } },
            },
          },
          { transaction },
        );
        for (const child of models) {
          const childOptions = object(child.get('options'));
          if (
            (parents.get(String(child.get('uid'))) ?? childOptions.parentId) === model.get('uid') &&
            childOptions.use === 'DisplayTextFieldModel'
          ) {
            await update.upsertModel(
              { uid: child.get('uid'), use: 'PermitDocumentSyncErrorFieldModel' },
              { transaction },
            );
          }
        }
      }
    });
  }
}
