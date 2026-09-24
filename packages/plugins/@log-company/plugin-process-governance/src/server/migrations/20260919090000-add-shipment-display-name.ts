/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DataTypes } from '@nocobase/database';
import { Migration } from '@nocobase/server';

interface MetadataRecord {
  get(key: string): unknown;
}

interface MetadataRepository {
  findOne(options: { filter: Record<string, unknown> }): Promise<MetadataRecord | null>;
  create(options: { values: Record<string, unknown> }): Promise<unknown>;
  update(options: { filter: Record<string, unknown>; values: Record<string, unknown> }): Promise<unknown>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const queryInterface = this.db.sequelize.getQueryInterface();
    const columns = await queryInterface.describeTable('shipments');
    if (!columns.display_name) {
      await queryInterface.addColumn('shipments', 'display_name', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }

    await this.db.sequelize.query(`
      update shipments s
      set display_name = concat(
        coalesce(nullif(btrim(s.shipment_number::text), ''), '—'), '/',
        coalesce(nullif(btrim(c.name), ''), '—'), '/',
        coalesce(nullif(btrim(s.invoice_number), ''), '—'), '/',
        coalesce(nullif(btrim(s.application_number), ''), '—'), '/',
        coalesce(nullif(btrim(s.declaration_number), ''), '—')
      )
      from chinese_clients c
      where c.id = s.chinese_client_id
    `);

    await this.synchronizeMetadata();
  }

  async down(): Promise<void> {
    // The calculated title and its user data references are intentionally preserved.
  }

  private async synchronizeMetadata(): Promise<void> {
    const collections = this.db.getRepository('collections') as unknown as MetadataRepository;
    await collections.update({ filter: { name: 'shipments' }, values: { titleField: 'display_name' } });

    const fields = this.db.getRepository('fields') as unknown as MetadataRepository;
    const displayNameField = await fields.findOne({ filter: { collectionName: 'shipments', name: 'display_name' } });
    const values = {
      collectionName: 'shipments',
      name: 'display_name',
      type: 'string',
      interface: 'input',
      allowNull: true,
      uiSchema: {
        type: 'string',
        title: 'Название поставки',
        'x-component': 'Input',
        'x-read-pretty': true,
      },
    };
    if (displayNameField) {
      await fields.update({ filter: { collectionName: 'shipments', name: 'display_name' }, values });
    } else {
      await fields.create({ values });
    }

    for (const name of ['vehicle_id', 'vehicle']) {
      await fields.update({
        filter: { collectionName: 'transport_runs', name },
        values: { hidden: true },
      });
    }

    for (const field of [
      { collectionName: 'transport_runs', name: 'shipments', multiple: true },
      { collectionName: 'shipment_comments', name: 'shipment', multiple: false },
    ]) {
      const record = await fields.findOne({ filter: { collectionName: field.collectionName, name: field.name } });
      if (!record) {
        continue;
      }
      const uiSchema = this.asRecord(record.get('uiSchema'));
      const componentProps = this.asRecord(uiSchema['x-component-props']);
      await fields.update({
        filter: { collectionName: field.collectionName, name: field.name },
        values: {
          uiSchema: {
            ...uiSchema,
            'x-component-props': {
              ...componentProps,
              multiple: field.multiple,
              fieldNames: { value: 'id', label: 'display_name' },
            },
          },
        },
      });
    }

    await this.db.sequelize.query(`
      update "dataSourcesRolesResourcesActions" actions
      set fields = coalesce(actions.fields, '[]'::jsonb) || '["display_name"]'::jsonb,
          "updatedAt" = now()
      from "dataSourcesRolesResources" resources
      where actions."rolesResourceId" = resources.id
        and resources.name = 'shipments'
        and not (coalesce(actions.fields, '[]'::jsonb) ? 'display_name')
    `);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
