/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DataTypes, type Model, type Transaction } from '@nocobase/database';
import { Migration } from '@nocobase/server';
import { LOGISTICS_COLLECTIONS, SHIPMENT_CUSTOMS_FIELD_LABELS } from '../../shared/logistics';
import logisticsWorkItems from '../collections/logisticsWorkItems';
import shipments from '../collections/shipments';
import type { WorkspaceFlowTree } from '../infrastructure/metadata/LogisticsWorkspaceNativeModels';
import { LOGISTICS_WORKSPACE_VIEW_WITH_60_DAY_DEADLINE_SQL } from '../infrastructure/read-model/LogisticsWorkspaceViewSql';

const TEN_DAY_FIELD = 'additional_check_response_deadline';
const SIXTY_DAY_FIELD = 'additional_check_response_deadline_60_days';
const COLLECTIONS = [LOGISTICS_COLLECTIONS.shipments, LOGISTICS_COLLECTIONS.workItems];
const PREVIOUS_LABELS = {
  ktc_amount: ['Сумма КТС'],
  [TEN_DAY_FIELD]: ['Срок ответа по дополнительной проверке', 'Срок ответа на дополнительную проверку', 'Срок ответа'],
} as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function renameLabels(value: unknown, previous: readonly string[], title: string): unknown {
  if (Array.isArray(value)) return value.map((item) => renameLabels(item, previous, title));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      (key === 'title' || key === 'label') && typeof item === 'string' && previous.includes(item)
        ? title
        : renameLabels(item, previous, title),
    ]),
  );
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.db.sequelize.transaction(async (transaction) => {
      const queryInterface = this.db.sequelize.getQueryInterface();
      const queryOptions = { transaction, logging: false as const };
      const columns = await queryInterface.describeTable(LOGISTICS_COLLECTIONS.shipments, queryOptions);
      // The existing date is the 10-day deadline. Keep its values and saved field references in place.
      if (!columns[SIXTY_DAY_FIELD]) {
        await queryInterface.addColumn(
          LOGISTICS_COLLECTIONS.shipments,
          SIXTY_DAY_FIELD,
          { type: DataTypes.DATEONLY, allowNull: true },
          { transaction },
        );
      }
      await this.db.sequelize.query(LOGISTICS_WORKSPACE_VIEW_WITH_60_DAY_DEADLINE_SQL, { transaction });
      await this.updateFieldMetadata(transaction);
      await this.extendFieldPermissions(transaction);
      await this.updateFlowModels(transaction);
    });
  }

  private async updateFieldMetadata(transaction: Transaction): Promise<void> {
    const fields = this.db.getRepository('fields');
    for (const collection of [shipments, logisticsWorkItems]) {
      for (const [name, title] of Object.entries(SHIPMENT_CUSTOMS_FIELD_LABELS)) {
        const filter = { collectionName: collection.name, name };
        const field = await fields.findOne({ filter, transaction });
        if (field) {
          const options = record(field.get('options'));
          const uiSchema = record(options.uiSchema);
          if (uiSchema.title !== title) {
            await field.update(
              { options: { ...options, uiSchema: { ...uiSchema, title } } },
              { transaction, hooks: false },
            );
          }
        } else {
          const definition = collection.fields?.find((item) => item.name === name);
          if (!definition) throw new Error(`Не найдено определение поля ${collection.name}.${name}`);
          const { type, interface: interfaceName, name: fieldName, ...options } = definition;
          await fields.create({
            // With hooks disabled, the UID hook does not populate the field key.
            values: {
              key: `lcshipmentcustoms_${collection.name}_${fieldName}`,
              collectionName: collection.name,
              name: fieldName,
              type,
              interface: interfaceName,
              options,
            },
            transaction,
            hooks: false,
          });
        }
      }
    }
  }

  private async extendFieldPermissions(transaction: Transaction): Promise<void> {
    const resources: Model[] = await this.db.getRepository('dataSourcesRolesResources').find({
      filter: { dataSourceKey: 'main', name: { $in: COLLECTIONS } },
      transaction,
    });
    if (!resources.length) return;
    const actions: Model[] = await this.db.getRepository('dataSourcesRolesResourcesActions').find({
      filter: { rolesResourceId: { $in: resources.map((resource) => resource.get('id')) } },
      transaction,
    });
    for (const action of actions) {
      const fields: unknown = action.get('fields');
      if (Array.isArray(fields) && fields.includes(TEN_DAY_FIELD) && !fields.includes(SIXTY_DAY_FIELD)) {
        await action.update({ fields: [...fields, SIXTY_DAY_FIELD] }, { transaction });
      }
    }
  }

  private async updateFlowModels(transaction: Transaction): Promise<void> {
    const repository = this.db.getRepository('flowModels') as unknown as {
      find(options: { transaction: Transaction }): Promise<Model[]>;
      upsertModel(model: WorkspaceFlowTree, options: { transaction: Transaction }): Promise<unknown>;
    };
    const models = (await repository.find({ transaction })).map((model) => {
      const options = record(model.get('options'));
      const binding = record(record(record(options.stepParams).fieldSettings).init);
      return { model, options, binding };
    });
    const relevant = models.filter(
      ({ binding }) =>
        (!binding.dataSourceKey || binding.dataSourceKey === 'main') &&
        COLLECTIONS.some((collectionName) => collectionName === binding.collectionName),
    );
    const gridsWithNewField = new Set(
      relevant
        .filter(({ options, binding }) => options.use === 'FormItemModel' && binding.fieldPath === SIXTY_DAY_FIELD)
        .map(({ options }) => options.parentId),
    );
    for (const { model, options, binding } of relevant) {
      const path = binding.fieldPath;
      if (path !== 'ktc_amount' && path !== TEN_DAY_FIELD) continue;
      const next = renameLabels(options, PREVIOUS_LABELS[path], SHIPMENT_CUSTOMS_FIELD_LABELS[path]);
      if (JSON.stringify(next) !== JSON.stringify(options)) {
        await model.update({ options: next }, { transaction, hooks: false });
      }
      const parentId = options.parentId;
      if (
        path !== TEN_DAY_FIELD ||
        binding.collectionName !== LOGISTICS_COLLECTIONS.shipments ||
        options.use !== 'FormItemModel' ||
        options.subKey !== 'items' ||
        typeof parentId !== 'string' ||
        gridsWithNewField.has(parentId)
      )
        continue;
      const uid = `lcdeadline60${parentId}`;
      // The native grid places new unpositioned items after the existing layout.
      await repository.upsertModel(
        {
          uid,
          use: 'FormItemModel',
          parentId,
          subKey: 'items',
          subType: 'array',
          stepParams: {
            fieldSettings: {
              init: {
                dataSourceKey: 'main',
                collectionName: LOGISTICS_COLLECTIONS.shipments,
                fieldPath: SIXTY_DAY_FIELD,
              },
            },
          },
          subModels: { field: { uid: `${uid}input`, use: 'DateOnlyFieldModel' } },
        },
        { transaction },
      );
      gridsWithNewField.add(parentId);
    }
  }
}
