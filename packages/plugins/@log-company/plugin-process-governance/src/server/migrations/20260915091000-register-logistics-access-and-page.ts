/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { LOGISTICS_COLLECTIONS } from '../../shared/logistics';

const CUSTOMS_CLEARANCE_ROUTE_UID = '50grjmakocx';
const LOGISTICS_MENU_TITLE_KEY = '@log-company/plugin-process-governance.logisticsMenuTitle';

const RUN_FIELDS = [
  'run_number',
  'status',
  'vehicle',
  'registration_number_input',
  'departure_city',
  'managers',
  'declarants',
  'shipments',
  'parent_runs',
  'child_runs',
  'history',
  'createdAt',
] as const;

const SHIPMENT_FIELDS = [
  'shipment_number',
  'display_name',
  'chinese_client',
  'company',
  'route_delivery_number',
  'invoice_number',
  'invoice_value',
  'contract_record',
  'customs_scheme',
  'customs_warehouse',
  'customs_warehouse_storage_date',
  'declaration_number',
  'application_number',
  'documents_in_badis',
  'customs_payments_amount',
  'eco_fee',
  'ktc_amount',
  'ntm_certificate_goods',
  'ntm_skk_goods',
  'ntm_kfk_goods',
  'ntm_honest_sign_goods',
  'ntm_export_declaration_required',
  'ntm_honest_sign_sum',
  'goods_count',
  'entered_in_1c',
  'sent_to_client',
  'declaration_release_date',
  'application_release_date',
  'additional_check_response_deadline',
  'actual_control',
  'anosov_distributed',
  'manager_comment',
  'runs',
  'comments',
  'history',
  'createdAt',
] as const;

const FINANCE_FIELDS = [
  'shipment_number',
  'display_name',
  'chinese_client',
  'company',
  'route_delivery_number',
  'invoice_number',
  'invoice_value',
  'contract_record',
  'customs_payments_amount',
  'eco_fee',
  'ktc_amount',
  'ntm_honest_sign_sum',
  'entered_in_1c',
  'sent_to_client',
  'runs',
  'history',
  'createdAt',
] as const;

interface RecordModel {
  id?: string | number | bigint;
  get?(key: string): unknown;
}

interface GenericRepository {
  findOne(options: { filter: Record<string, unknown> }): Promise<RecordModel | null>;
  create(options: { values: Record<string, unknown> }): Promise<RecordModel>;
  update?(options: { filterByTk: string | number | bigint; values: Record<string, unknown> }): Promise<unknown>;
}

interface PermissionDefinition {
  roleName: string;
  resource: string;
  actions: Array<{ name: 'view' | 'create' | 'update'; fields: readonly string[] }>;
}

const PERMISSIONS: PermissionDefinition[] = [
  ...['manager', 'declarant'].flatMap((roleName) => [
    {
      roleName,
      resource: LOGISTICS_COLLECTIONS.runs,
      actions: [
        { name: 'view' as const, fields: RUN_FIELDS },
        { name: 'create' as const, fields: RUN_FIELDS },
        { name: 'update' as const, fields: RUN_FIELDS },
      ],
    },
    {
      roleName,
      resource: LOGISTICS_COLLECTIONS.shipments,
      actions: [
        { name: 'view' as const, fields: SHIPMENT_FIELDS },
        { name: 'create' as const, fields: SHIPMENT_FIELDS },
        { name: 'update' as const, fields: SHIPMENT_FIELDS },
      ],
    },
    {
      roleName,
      resource: LOGISTICS_COLLECTIONS.vehicles,
      actions: [{ name: 'view' as const, fields: ['registration_number', 'runs'] }],
    },
    {
      roleName,
      resource: LOGISTICS_COLLECTIONS.runHistory,
      actions: [
        {
          name: 'view' as const,
          fields: ['event_type', 'field_label', 'old_value', 'new_value', 'createdAt', 'createdBy'],
        },
      ],
    },
    {
      roleName,
      resource: LOGISTICS_COLLECTIONS.shipmentHistory,
      actions: [
        {
          name: 'view' as const,
          fields: ['event_type', 'field_label', 'old_value', 'new_value', 'createdAt', 'createdBy'],
        },
      ],
    },
    {
      roleName,
      resource: LOGISTICS_COLLECTIONS.shipmentComments,
      actions: [
        { name: 'view' as const, fields: ['shipment', 'text', 'attachment', 'createdAt', 'createdBy'] },
        { name: 'create' as const, fields: ['shipment', 'text', 'attachment'] },
        { name: 'update' as const, fields: ['text', 'attachment'] },
      ],
    },
  ]),
  {
    roleName: 'financier',
    resource: LOGISTICS_COLLECTIONS.runs,
    actions: [{ name: 'view', fields: RUN_FIELDS }],
  },
  {
    roleName: 'financier',
    resource: LOGISTICS_COLLECTIONS.shipments,
    actions: [
      { name: 'view', fields: SHIPMENT_FIELDS },
      { name: 'update', fields: FINANCE_FIELDS },
    ],
  },
  {
    roleName: 'financier',
    resource: LOGISTICS_COLLECTIONS.runHistory,
    actions: [
      { name: 'view', fields: ['event_type', 'field_label', 'old_value', 'new_value', 'createdAt', 'createdBy'] },
    ],
  },
  {
    roleName: 'financier',
    resource: LOGISTICS_COLLECTIONS.shipmentHistory,
    actions: [
      { name: 'view', fields: ['event_type', 'field_label', 'old_value', 'new_value', 'createdAt', 'createdBy'] },
    ],
  },
];

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.registerPage();
    for (const permission of PERMISSIONS) {
      await this.ensurePermission(permission);
    }
  }

  async down(): Promise<void> {
    // Preserve the page route and explicit role configuration.
  }

  private async registerPage(): Promise<void> {
    const routes = this.db.getRepository('desktopRoutes') as unknown as GenericRepository;
    const existing = await routes.findOne({ filter: { schemaUid: CUSTOMS_CLEARANCE_ROUTE_UID } });
    const values = {
      title: LOGISTICS_MENU_TITLE_KEY,
      type: 'link',
      options: { href: '/admin/customs-clearance', openInNewWindow: false },
    };
    if (existing) {
      const id = this.modelId(existing);
      if (routes.update && id !== null) {
        await routes.update({ filterByTk: id, values });
      }
      return;
    }
    await routes.create({
      values: {
        ...values,
        schemaUid: CUSTOMS_CLEARANCE_ROUTE_UID,
        icon: 'CarOutlined',
        sort: 1,
      },
    });
  }

  private async ensurePermission(definition: PermissionDefinition): Promise<void> {
    const resources = this.db.getRepository('dataSourcesRolesResources') as unknown as GenericRepository;
    const actions = this.db.getRepository('dataSourcesRolesResourcesActions') as unknown as GenericRepository;
    let resource = await resources.findOne({
      filter: { dataSourceKey: 'main', roleName: definition.roleName, name: definition.resource },
    });
    if (!resource) {
      resource = await resources.create({
        values: {
          dataSourceKey: 'main',
          roleName: definition.roleName,
          name: definition.resource,
          usingActionsConfig: true,
        },
      });
    }
    const resourceId = this.modelId(resource);
    if (resourceId === null) {
      throw new Error(`Не удалось определить ACL-ресурс ${definition.roleName}:${definition.resource}.`);
    }
    for (const action of definition.actions) {
      const exists = await actions.findOne({ filter: { rolesResourceId: resourceId, name: action.name } });
      if (!exists) {
        await actions.create({
          values: { rolesResourceId: resourceId, name: action.name, fields: [...action.fields] },
        });
      }
    }
  }

  private modelId(model: RecordModel): string | number | bigint | null {
    const value = model.id ?? model.get?.('id');
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' ? value : null;
  }
}
