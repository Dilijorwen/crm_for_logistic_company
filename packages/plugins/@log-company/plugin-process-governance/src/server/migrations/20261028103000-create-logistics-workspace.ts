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
import {
  ensureLogisticsWorkspacePage,
  LOGISTICS_WORKSPACE_ROUTE_UID,
} from '../infrastructure/metadata/LogisticsWorkspacePage';
import { LOGISTICS_WORKSPACE_VIEW_SQL } from '../infrastructure/read-model/LogisticsWorkspaceViewSql';

const WORKSPACE_FIELDS = [
  'id',
  'run_number',
  'registration_number',
  'departure_city_name',
  'manager_names',
  'declarant_names',
  'shipment_number',
  'shipment_display_name',
  'chinese_client_name',
  'company_name',
  'contract_name',
  'status',
  'route_delivery_number',
  'invoice_number',
  'invoice_value',
  'customs_scheme',
  'customs_warehouse_name',
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
] as const;

const FINANCE_WORKSPACE_FIELDS = [
  'id',
  'run_number',
  'registration_number',
  'departure_city_name',
  'manager_names',
  'declarant_names',
  'shipment_number',
  'shipment_display_name',
  'chinese_client_name',
  'company_name',
  'contract_name',
  'route_delivery_number',
  'invoice_number',
  'invoice_value',
  'customs_payments_amount',
  'eco_fee',
  'ktc_amount',
  'ntm_honest_sign_sum',
  'entered_in_1c',
  'sent_to_client',
] as const;

interface ModelRecord {
  id?: string | number | bigint;
  get(name: string): unknown;
}

interface Repository {
  create(options: { values: Record<string, unknown> }): Promise<ModelRecord>;
  find(options: { filter: Record<string, unknown> }): Promise<ModelRecord[]>;
  findOne(options: { filter: Record<string, unknown> }): Promise<ModelRecord | null>;
  update?(options: { filter: Record<string, unknown>; values: Record<string, unknown> }): Promise<unknown>;
}

interface CollectionMetadataRepository extends Repository {
  db2cm?(name: string): Promise<void>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.db.sequelize.query(LOGISTICS_WORKSPACE_VIEW_SQL);
    await this.ensureCollectionMetadata();
    await this.ensureReadPermissions();
    const routeId = await this.ensureRoute();
    await this.ensureRouteRoles(routeId);
    await ensureLogisticsWorkspacePage(this.db);
  }

  async down(): Promise<void> {
    // This read model may be referenced by saved personal column settings, so it is retained.
  }

  private async ensureCollectionMetadata(): Promise<void> {
    const repository = this.db.getRepository('collections') as unknown as CollectionMetadataRepository;
    const existing = await repository.findOne({ filter: { name: LOGISTICS_COLLECTIONS.workItems } });
    if (!existing && repository.db2cm) {
      await repository.db2cm(LOGISTICS_COLLECTIONS.workItems);
    }
  }

  private async ensureReadPermissions(): Promise<void> {
    await this.ensurePermission('manager', WORKSPACE_FIELDS);
    await this.ensurePermission('declarant', WORKSPACE_FIELDS);
    await this.ensurePermission('financier', FINANCE_WORKSPACE_FIELDS);
  }

  private async ensurePermission(roleName: string, fields: readonly string[]): Promise<void> {
    const resources = this.db.getRepository('dataSourcesRolesResources') as unknown as Repository;
    const actions = this.db.getRepository('dataSourcesRolesResourcesActions') as unknown as Repository;
    let resource = await resources.findOne({
      filter: { dataSourceKey: 'main', roleName, name: LOGISTICS_COLLECTIONS.workItems },
    });
    if (!resource) {
      resource = await resources.create({
        values: {
          dataSourceKey: 'main',
          roleName,
          name: LOGISTICS_COLLECTIONS.workItems,
          usingActionsConfig: true,
        },
      });
    }
    const resourceId = this.modelId(resource);
    if (resourceId === null) {
      throw new Error(`Не удалось определить ACL-ресурс ${roleName}:${LOGISTICS_COLLECTIONS.workItems}.`);
    }
    const action = await actions.findOne({ filter: { rolesResourceId: resourceId, name: 'view' } });
    if (!action) {
      await actions.create({ values: { rolesResourceId: resourceId, name: 'view', fields: [...fields] } });
      return;
    }
    const existingFields = action.get('fields');
    const merged = new Set(Array.isArray(existingFields) ? existingFields.filter(this.isString) : []);
    fields.forEach((field) => merged.add(field));
    if (actions.update) {
      await actions.update({ filter: { rolesResourceId: resourceId, name: 'view' }, values: { fields: [...merged] } });
    }
  }

  private async ensureRoute(): Promise<string | number | bigint> {
    const routes = this.db.getRepository('desktopRoutes') as unknown as Repository;
    let route = await routes.findOne({ filter: { schemaUid: LOGISTICS_WORKSPACE_ROUTE_UID } });
    if (!route) {
      route = await routes.create({
        values: {
          schemaUid: LOGISTICS_WORKSPACE_ROUTE_UID,
          title: 'Общий рабочий список',
          icon: 'UnorderedListOutlined',
          type: 'flowPage',
          sort: 2,
          hideInMenu: false,
        },
      });
    }
    const routeId = this.modelId(route);
    if (routeId === null) {
      throw new Error('Не удалось определить пункт меню общего рабочего списка.');
    }
    return routeId;
  }

  private async ensureRouteRoles(routeId: string | number | bigint): Promise<void> {
    const repository = this.db.getRepository('rolesDesktopRoutes') as unknown as Repository;
    for (const roleName of ['admin', 'manager', 'declarant', 'financier']) {
      const existing = await repository.findOne({ filter: { desktopRouteId: routeId, roleName } });
      if (!existing) {
        await repository.create({ values: { desktopRouteId: routeId, roleName } });
      }
    }
  }

  private modelId(model: ModelRecord): string | number | bigint | null {
    const value = model.id ?? model.get('id');
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' ? value : null;
  }

  private isString(value: unknown): value is string {
    return typeof value === 'string';
  }
}
