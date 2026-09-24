/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';

const TIMESTAMP_FIELDS = ['createdAt', 'updatedAt'] as const;

const VIEW_PERMISSIONS = [
  { roleName: 'manager', resource: 'transport_runs' },
  { roleName: 'manager', resource: 'shipments' },
  { roleName: 'manager', resource: 'shipment_comments' },
  { roleName: 'declarant', resource: 'transport_runs' },
  { roleName: 'declarant', resource: 'shipments' },
  { roleName: 'declarant', resource: 'shipment_comments' },
  { roleName: 'financier', resource: 'transport_runs' },
  { roleName: 'financier', resource: 'shipments' },
] as const;

interface MetadataModel {
  id?: string | number | bigint;
  get(name: string): unknown;
  update(values: Record<string, unknown>): Promise<unknown>;
}

interface MetadataRepository {
  findOne(options: { filter: Record<string, unknown> }): Promise<MetadataModel | null>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const resources = this.db.getRepository('dataSourcesRolesResources') as unknown as MetadataRepository;
    const actions = this.db.getRepository('dataSourcesRolesResourcesActions') as unknown as MetadataRepository;

    for (const permission of VIEW_PERMISSIONS) {
      const resource = await resources.findOne({
        filter: { dataSourceKey: 'main', roleName: permission.roleName, name: permission.resource },
      });
      if (!resource) {
        continue;
      }
      const resourceId = this.modelId(resource);
      if (resourceId === null) {
        throw new Error(`Не удалось определить ACL-ресурс ${permission.roleName}:${permission.resource}.`);
      }
      const action = await actions.findOne({ filter: { rolesResourceId: resourceId, name: 'view' } });
      if (!action) {
        continue;
      }
      const fields = action.get('fields');
      if (!Array.isArray(fields)) {
        continue;
      }
      const mergedFields = new Set(fields.filter((field): field is string => typeof field === 'string'));
      for (const field of TIMESTAMP_FIELDS) {
        mergedFields.add(field);
      }
      await action.update({ fields: [...mergedFields] });
    }
  }

  async down(): Promise<void> {
    // Keep timestamp access because removing it would hide accounting data again.
  }

  private modelId(model: MetadataModel): string | number | bigint | null {
    const value = model.id ?? model.get('id');
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' ? value : null;
  }
}
