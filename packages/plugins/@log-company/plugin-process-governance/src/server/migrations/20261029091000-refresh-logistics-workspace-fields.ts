/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import logisticsWorkItems from '../collections/logisticsWorkItems';

const CORRECTED_FIELDS = new Set([
  'run_number',
  'shipment_number',
  'customs_scheme',
  'run_id',
  'shipment_id',
  'run',
  'shipment',
]);

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    // db2cm skips already registered collections. Refresh only these managed
    // fields so existing installations also receive the corrected metadata.
    const fields = this.db.getRepository('fields');
    for (const definition of logisticsWorkItems.fields || []) {
      if (!CORRECTED_FIELDS.has(definition.name)) continue;
      const { name, type, interface: fieldInterface, ...options } = definition;
      const existing = await fields.findOne({ filter: { collectionName: logisticsWorkItems.name, name } });
      if (!existing) {
        await fields.create({ values: { collectionName: logisticsWorkItems.name, ...definition } });
        continue;
      }
      const current = record(existing.get('options'));
      const currentUi = record(current.uiSchema);
      const correctedUi = record(options.uiSchema);
      const mergedOptions = { ...current, ...options };
      if (options.uiSchema) {
        mergedOptions.uiSchema = {
          ...correctedUi,
          ...currentUi,
          type: correctedUi.type,
          'x-component': correctedUi['x-component'],
        };
      }
      await existing.update({ type, interface: fieldInterface, options: mergedOptions });
    }
  }
}
