/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database, Transaction, Model } from '@nocobase/database';
import transportRuns from '../../collections/transportRuns';
import workItems from '../../collections/logisticsWorkItems';
import { LOGISTICS_WORKSPACE_VIEW_SQL } from '../read-model/LogisticsWorkspaceViewSql';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function replaceNames(value: unknown): unknown {
  if (typeof value === 'string')
    return value === 'Название поставки'
      ? 'Номер поставки'
      : value === 'display_name' || value === 'shipment_display_name'
        ? 'shipment_number'
        : value.replace(/\.(?:shipment_display_name|display_name)(?=[.}\s]|$)/g, '.shipment_number');
  if (Array.isArray(value)) return value.map(replaceNames);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceNames(item)]));
  return value;
}

export async function retireShipmentNames(db: Database): Promise<void> {
  const shipmentColumns = await db.sequelize.getQueryInterface().describeTable('shipments');
  await db.sequelize.transaction(async (transaction: Transaction) => {
    // Rebuild atomically: PostgreSQL cannot remove a projected column with CREATE OR REPLACE VIEW.
    await db.sequelize.query('DROP VIEW IF EXISTS public.logistics_work_items', { transaction });
    await db.sequelize.query(LOGISTICS_WORKSPACE_VIEW_SQL, { transaction });
    for (const [collectionName, name] of [
      ['shipments', 'display_name'],
      ['logistics_work_items', 'shipment_display_name'],
    ]) {
      db.getCollection(collectionName)?.removeField(name);
      await db
        .getRepository('fields')
        .model.destroy({ where: { collectionName, name }, hooks: false, individualHooks: false, transaction });
    }
    await db.getRepository('collections').update({
      filter: { name: { $in: ['shipments', 'logistics_work_items'] } },
      values: { titleField: 'shipment_number' },
      transaction,
    });
    const fields = await db.getRepository('fields').find({ transaction });
    for (const field of fields) {
      if (field.get('target') !== 'shipments') continue;
      const uiSchema = record(field.get('uiSchema'));
      const component = record(uiSchema['x-component-props']);
      await field.update(
        {
          uiSchema: {
            ...uiSchema,
            'x-component-props': {
              ...component,
              fieldNames: { ...record(component.fieldNames), label: 'shipment_number' },
            },
          },
        },
        { transaction },
      );
    }
    for (const collection of [transportRuns, workItems]) {
      const definition = collection.fields?.find((field) => field.name === 'transport_type');
      if (!definition) throw new Error('Transport type metadata is not defined');
      const field = await db
        .getRepository('fields')
        .findOne({ filter: { collectionName: collection.name, name: 'transport_type' }, transaction });
      if (field) await field.update({ ...definition }, { transaction });
      else
        await db
          .getRepository('fields')
          .create({ values: { collectionName: collection.name, ...definition }, transaction });
    }
    const resources = await db
      .getRepository('dataSourcesRolesResources')
      .find({ filter: { name: { $in: ['transport_runs', 'shipments', 'logistics_work_items'] } }, transaction });
    for (const resource of resources) {
      const actions = await db
        .getRepository('dataSourcesRolesResourcesActions')
        .find({ filter: { rolesResourceId: resource.get('id') }, transaction });
      for (const action of actions) {
        const allowed: unknown = action.get('fields');
        if (!Array.isArray(allowed)) continue;
        const next = new Set(
          allowed
            .filter((name): name is string => typeof name === 'string')
            .map((name) => (name === 'display_name' || name === 'shipment_display_name' ? 'shipment_number' : name)),
        );
        if (
          resource.get('name') !== 'shipments' &&
          (next.has('run_number') || next.has('registration_number_input') || next.has('registration_number'))
        )
          next.add('transport_type');
        await action.update({ fields: Array.from(next) }, { transaction });
      }
    }
    const models: Model[] = await db.getRepository('flowModels').find({ transaction });
    const byUid = new Map(models.map((model) => [String(model.get('uid')), model]));
    for (const model of models) {
      const options = record(model.get('options'));
      let cursor = options;
      let target = false;
      for (let depth = 0; depth < 20; depth++) {
        const steps = record(cursor.stepParams);
        const binding = record(record(steps.fieldSettings).init);
        const source = record(record(steps.resourceSettings).init);
        const association =
          typeof binding.fieldPath === 'string'
            ? db.getCollection(String(binding.collectionName))?.getField(binding.fieldPath.split('.')[0])
            : undefined;
        if (
          ['shipments', 'logistics_work_items'].includes(String(binding.collectionName || source.collectionName)) ||
          association?.options.target === 'shipments'
        ) {
          target = true;
          break;
        }
        const parent = byUid.get(String(cursor.parentId));
        if (!parent) break;
        cursor = record(parent.get('options'));
      }
      if (target && /(?:shipment_display_name|display_name)/.test(JSON.stringify(options)))
        await model.update({ options: replaceNames(options) }, { transaction, hooks: false });
    }
    // Existing independently designed run forms must remain usable with the new required field.
    const flowRepository = db.getRepository('flowModels') as unknown as {
      upsertModel(options: Record<string, unknown>, transaction: { transaction: Transaction }): Promise<unknown>;
    };
    for (const model of models) {
      const uid = String(model.get('uid'));
      const options = record(model.get('options'));
      const source = record(record(record(options.stepParams).resourceSettings).init);
      if (
        uid.startsWith('lcws') ||
        !['CreateFormModel', 'EditFormModel'].includes(String(options.use)) ||
        source.collectionName !== 'transport_runs'
      )
        continue;
      const formGrid = models.find(
        (child) => record(child.get('options')).parentId === uid && record(child.get('options')).subKey === 'grid',
      );
      if (!formGrid) continue;
      const gridUid = String(formGrid.get('uid'));
      const alreadyExists = models.some((field) => {
        const fieldOptions = record(field.get('options'));
        return (
          fieldOptions.parentId === gridUid &&
          record(record(record(fieldOptions.stepParams).fieldSettings).init).fieldPath === 'transport_type'
        );
      });
      if (alreadyExists) continue;
      const fieldUid = `lcmode${uid}`;
      await flowRepository.upsertModel(
        {
          uid: fieldUid,
          use: 'FormItemModel',
          parentId: gridUid,
          subKey: 'items',
          subType: 'array',
          stepParams: {
            fieldSettings: {
              init: { dataSourceKey: 'main', collectionName: 'transport_runs', fieldPath: 'transport_type' },
            },
            editItemSettings: { required: { required: true } },
          },
          subModels: {
            field: {
              uid: `${fieldUid}input`,
              use: 'SelectFieldModel',
              parentId: fieldUid,
              subKey: 'field',
              subType: 'object',
            },
          },
        },
        { transaction },
      );
    }
    if (shipmentColumns.display_name)
      await db.sequelize.getQueryInterface().removeColumn('shipments', 'display_name', { transaction });
  });
}
