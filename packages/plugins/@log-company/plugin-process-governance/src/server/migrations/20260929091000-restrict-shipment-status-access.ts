/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
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
        and shipment_resource."dataSourceKey" = 'main'
        and shipment_resource.name = 'shipments'
        and shipment_action.fields ? 'status'
        and (
          (shipment_resource."roleName" = 'manager' and shipment_action.name in ('create', 'update'))
          or (shipment_resource."roleName" = 'financier' and shipment_action.name = 'update')
        )
    `);

    await this.db.sequelize.query(`
      update "dataSourcesRolesResourcesActions" shipment_action
      set fields = shipment_action.fields || '["status"]'::jsonb,
          "updatedAt" = now()
      from "dataSourcesRolesResources" shipment_resource
      where shipment_action."rolesResourceId" = shipment_resource.id
        and shipment_resource."dataSourceKey" = 'main'
        and shipment_resource.name = 'shipments'
        and jsonb_typeof(shipment_action.fields) = 'array'
        and jsonb_array_length(shipment_action.fields) > 0
        and not (shipment_action.fields ? 'status')
        and (
          (shipment_resource."roleName" = 'declarant' and shipment_action.name in ('view', 'create', 'update'))
          or (shipment_resource."roleName" in ('manager', 'financier') and shipment_action.name = 'view')
        )
    `);
  }

  async down(): Promise<void> {
    // Keep the least-privilege field configuration.
  }
}
