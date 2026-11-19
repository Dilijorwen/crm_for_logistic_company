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
import {
  shipmentChineseClientsField,
  clientShipmentsField,
} from '../infrastructure/metadata/LogisticsAssociationFields';
import { LOGISTICS_WORKSPACE_VIEW_WITH_MULTIPLE_CLIENTS_SQL } from '../infrastructure/read-model/LogisticsWorkspaceViewSql';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.db.sequelize.transaction(async (transaction) => {
      const queryInterface = this.db.sequelize.getQueryInterface();
      if (!(await queryInterface.tableExists('shipment_chinese_clients', { transaction }))) {
        await queryInterface.createTable(
          'shipment_chinese_clients',
          {
            id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
            shipment_id: { type: DataTypes.BIGINT, allowNull: false },
            chinese_client_id: { type: DataTypes.BIGINT, allowNull: false },
          },
          { transaction },
        );
      }
      await this.db.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS shipment_chinese_clients_unique ON shipment_chinese_clients (shipment_id, chinese_client_id)',
        { transaction },
      );
      await this.db.sequelize.query(
        'CREATE INDEX IF NOT EXISTS shipment_chinese_clients_client_idx ON shipment_chinese_clients (chinese_client_id)',
        { transaction },
      );
      const references = await queryInterface.getForeignKeyReferencesForTable('shipment_chinese_clients', {
        transaction,
      });
      for (const [column, target, onDelete] of [
        ['shipment_id', 'shipments', 'CASCADE'],
        ['chinese_client_id', 'chinese_clients', 'RESTRICT'],
      ] as const) {
        if (
          !Array.isArray(references) ||
          !references.some((reference: { columnName?: string }) => reference.columnName === column)
        ) {
          await queryInterface.addConstraint('shipment_chinese_clients', {
            fields: [column],
            type: 'foreign key',
            name: `shipment_chinese_clients_${column}_fk`,
            references: { table: target, field: 'id' },
            onDelete,
            onUpdate: 'CASCADE',
            transaction,
          });
        }
      }
      // A repeat must never re-add a legacy client removed from an already migrated shipment.
      await this.db.sequelize.query(
        `INSERT INTO shipment_chinese_clients (shipment_id, chinese_client_id)
        SELECT shipment.id, shipment.chinese_client_id FROM shipments shipment
        WHERE shipment.chinese_client_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM shipment_chinese_clients membership WHERE membership.shipment_id=shipment.id
        ) ON CONFLICT DO NOTHING`,
        { transaction },
      );
      await this.changeAssociation('shipments', shipmentChineseClientsField, transaction);
      await this.changeAssociation('chinese_clients', clientShipmentsField, transaction);
      const projection = await this.db
        .getRepository('fields')
        .findOne({ filter: { collectionName: 'logistics_work_items', name: 'chinese_client_name' }, transaction });
      if (projection) {
        const options = record(projection.get('options'));
        await projection.update(
          { options: { ...options, uiSchema: { ...record(options.uiSchema), title: 'Китайские клиенты' } } },
          { transaction, hooks: false },
        );
      }
      await this.updateModels(transaction);
      // Aggregated names use text instead of the former single varchar value.
      // Recreate atomically and keep RESTRICT so unknown dependent views are protected.
      await this.db.sequelize.query('DROP VIEW IF EXISTS public.logistics_work_items', { transaction });
      await this.db.sequelize.query(LOGISTICS_WORKSPACE_VIEW_WITH_MULTIPLE_CLIENTS_SQL, { transaction });
    });
  }

  private async changeAssociation(
    collectionName: string,
    definition: Record<string, unknown>,
    transaction: Transaction,
  ): Promise<void> {
    const fields = this.db.getRepository('fields');
    const current = await fields.findOne({ filter: { collectionName, name: String(definition.name) }, transaction });
    const { name, type, interface: fieldInterface, ...options } = definition;
    const previous = record(current?.get('options'));
    const { allowNull: _allowNull, ...preserved } = previous;
    const uiSchema = record(options.uiSchema);
    const next = {
      ...preserved,
      ...options,
      uiSchema: {
        ...record(previous.uiSchema),
        ...uiSchema,
        'x-component-props': {
          ...record(record(previous.uiSchema)['x-component-props']),
          ...record(uiSchema['x-component-props']),
        },
      },
    };
    if (current)
      await current.update({ type, interface: fieldInterface, options: next }, { transaction, hooks: false });
    else
      await fields.create({
        values: {
          key: `lcclients_${collectionName}_${name}`,
          collectionName,
          name,
          type,
          interface: fieldInterface,
          options: next,
        },
        transaction,
        hooks: false,
      });
  }

  private async updateModels(transaction: Transaction): Promise<void> {
    const models: Model[] = await this.db.getRepository('flowModels').find({ transaction });
    const byUid = new Map(models.map((model) => [String(model.get('uid')), model]));
    for (const model of models) {
      const options = record(model.get('options'));
      const parent = record(byUid.get(String(options.parentId))?.get('options'));
      const steps = record(options.stepParams);
      const binding = record(record(steps.fieldSettings).init);
      const parentBinding = record(record(record(parent.stepParams).fieldSettings).init);
      const source = binding.fieldPath ? binding : parentBinding;
      if (source.dataSourceKey && source.dataSourceKey !== 'main') continue;
      if (source.collectionName === 'shipments' && source.fieldPath === 'chinese_client') {
        const props = { ...record(options.props) };
        if (props.label === 'Китайский клиент') props.label = 'Китайские клиенты';
        if (props.title === 'Китайский клиент') props.title = 'Китайские клиенты';
        if (options.use === 'RecordSelectFieldModel') Object.assign(props, { multiple: true, allowMultiple: true });
        const edit = record(steps.editItemSettings);
        const label = record(edit.label);
        const nextSteps: Record<string, unknown> =
          label.label === 'Китайский клиент'
            ? { ...steps, editItemSettings: { ...edit, label: { ...label, label: 'Китайские клиенты' } } }
            : { ...steps };
        if (options.use === 'RecordSelectFieldModel') {
          const selectSettings = record(nextSteps.selectSettings);
          nextSteps.selectSettings = {
            ...selectSettings,
            allowMultiple: { ...record(selectSettings.allowMultiple), allowMultiple: true },
          };
        }
        await model.update({ options: { ...options, props, stepParams: nextSteps } }, { transaction, hooks: false });
      }
    }
  }
}
