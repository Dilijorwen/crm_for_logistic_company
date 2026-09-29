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
import { LOGISTICS_STATUS_VALUES } from '../../shared/logistics';
import { statusField } from '../collections/logisticsCollectionFields';

interface MetadataRecord {
  update(values: Record<string, unknown>): Promise<unknown>;
}

interface MetadataRepository {
  findOne(options: { filter: Record<string, unknown> }): Promise<MetadataRecord | null>;
  create(options: { values: Record<string, unknown> }): Promise<unknown>;
  destroy(options: { filter: Record<string, unknown> }): Promise<unknown>;
}

const STATUS_CHECK_VALUES = LOGISTICS_STATUS_VALUES.map((value) => `'${value}'`).join(',');

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const queryInterface = this.db.sequelize.getQueryInterface();
    const shipmentColumns = await queryInterface.describeTable('shipments');

    if (!shipmentColumns.status) {
      await queryInterface.addColumn('shipments', 'status', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }

    await this.db.sequelize.query(`
      update shipments shipment
      set status = coalesce(
        (
          select run.status
          from transport_run_shipments link
          join transport_runs run on run.id = link.transport_run_id
          where link.shipment_id = shipment.id
          order by run."updatedAt" desc nulls last, run."createdAt" desc nulls last, run.run_number desc
          limit 1
        ),
        'queue'
      )
      where shipment.status is null or btrim(shipment.status) = ''
    `);

    await queryInterface.changeColumn('shipments', 'status', {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'queue',
    });

    await this.db.sequelize.query(`
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'shipments_status_check'
            and conrelid = 'shipments'::regclass
        ) then
          alter table shipments
          add constraint shipments_status_check check (status in (${STATUS_CHECK_VALUES}));
        end if;
      end
      $$
    `);
    await this.db.sequelize.query(`
      create index if not exists shipments_status_updated_at_idx
      on shipments (status, "updatedAt")
    `);

    await this.synchronizeShipmentMetadata();
    await this.transferAcl();
    await this.removeRunStatusMetadata();
  }

  async down(): Promise<void> {
    // The populated shipment status is intentionally retained. The legacy run column is also kept for staged cleanup.
  }

  private async synchronizeShipmentMetadata(): Promise<void> {
    const fields = this.db.getRepository('fields') as unknown as MetadataRepository;
    const { name, type, interface: fieldInterface, ...options } = statusField;
    const shipmentStatus = await fields.findOne({ filter: { collectionName: 'shipments', name: 'status' } });
    if (shipmentStatus) {
      await shipmentStatus.update({ type, interface: fieldInterface, options });
    } else {
      await fields.create({
        values: {
          collectionName: 'shipments',
          name,
          type,
          interface: fieldInterface,
          ...options,
        },
      });
    }
  }

  private async removeRunStatusMetadata(): Promise<void> {
    const fields = this.db.getRepository('fields') as unknown as MetadataRepository;
    this.db.getCollection('transport_runs')?.removeField('status');
    await fields.destroy({ filter: { collectionName: 'transport_runs', name: 'status' } });
  }

  private async transferAcl(): Promise<void> {
    await this.db.sequelize.query(`
      update "dataSourcesRolesResourcesActions" shipment_action
      set fields = (
            select coalesce(jsonb_agg(field_name), '[]'::jsonb)
            from jsonb_array_elements_text(shipment_action.fields) field_name
            where field_name <> 'status'
          ),
          "updatedAt" = now()
      from "dataSourcesRolesResources" shipment_resource
      where shipment_action."rolesResourceId" = shipment_resource.id
        and shipment_resource.name = 'shipments'
        and jsonb_typeof(shipment_action.fields) = 'array'
        and shipment_action.fields ? 'status'
        and not exists (
          select 1
          from "dataSourcesRolesResources" run_resource
          join "dataSourcesRolesResourcesActions" run_action
            on run_action."rolesResourceId" = run_resource.id
          where run_resource.name = 'transport_runs'
            and run_resource."dataSourceKey" = shipment_resource."dataSourceKey"
            and run_resource."roleName" = shipment_resource."roleName"
            and run_action.name = shipment_action.name
            and jsonb_typeof(run_action.fields) = 'array'
            and run_action.fields ? 'status'
        )
    `);

    await this.db.sequelize.query(`
      update "dataSourcesRolesResourcesActions" shipment_action
      set fields = shipment_action.fields || '["status"]'::jsonb,
          "updatedAt" = now()
      from "dataSourcesRolesResources" shipment_resource,
           "dataSourcesRolesResources" run_resource,
           "dataSourcesRolesResourcesActions" run_action
      where shipment_action."rolesResourceId" = shipment_resource.id
        and run_action."rolesResourceId" = run_resource.id
        and shipment_resource.name = 'shipments'
        and run_resource.name = 'transport_runs'
        and shipment_resource."dataSourceKey" = run_resource."dataSourceKey"
        and shipment_resource."roleName" = run_resource."roleName"
        and shipment_action.name = run_action.name
        and jsonb_typeof(shipment_action.fields) = 'array'
        and jsonb_array_length(shipment_action.fields) > 0
        and not (shipment_action.fields ? 'status')
        and jsonb_typeof(run_action.fields) = 'array'
        and run_action.fields ? 'status'
    `);

    await this.db.sequelize.query(`
      update "dataSourcesRolesResourcesActions" run_action
      set fields = (
            select coalesce(jsonb_agg(field_name), '[]'::jsonb)
            from jsonb_array_elements_text(run_action.fields) field_name
            where field_name <> 'status'
          ),
          "updatedAt" = now()
      from "dataSourcesRolesResources" run_resource
      where run_action."rolesResourceId" = run_resource.id
        and run_resource.name = 'transport_runs'
        and jsonb_typeof(run_action.fields) = 'array'
        and jsonb_array_length(run_action.fields) > 1
        and run_action.fields ? 'status'
    `);

    await this.db.sequelize.query(`
      delete from "dataSourcesRolesResourcesActions" run_action
      using "dataSourcesRolesResources" run_resource
      where run_action."rolesResourceId" = run_resource.id
        and run_resource.name = 'transport_runs'
        and jsonb_typeof(run_action.fields) = 'array'
        and jsonb_array_length(run_action.fields) = 1
        and run_action.fields ? 'status'
    `);
  }
}
