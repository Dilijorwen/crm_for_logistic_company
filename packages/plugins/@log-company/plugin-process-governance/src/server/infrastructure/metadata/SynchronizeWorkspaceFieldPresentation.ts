/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database, Transaction } from '@nocobase/database';
import { LOGISTICS_WORKSPACE_FIELD_SOURCES } from '../read-model/LogisticsWorkspaceFields';

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Copy presentation semantics from real collection metadata, never touch shipment values. */
export async function synchronizeWorkspaceFieldPresentation(db: Database, transaction: Transaction): Promise<void> {
  const fields = db.getRepository('fields');
  for (const mapping of LOGISTICS_WORKSPACE_FIELD_SOURCES) {
    const source = await fields.findOne({
      filter: { collectionName: mapping.resource, name: mapping.sourceField },
      transaction,
    });
    const target = await fields.findOne({
      filter: { collectionName: 'logistics_work_items', name: mapping.name },
      transaction,
    });
    if (!source || !target) continue;
    // Association titles and employee lists are deliberately flattened by the SQL view.
    if (['belongsTo', 'belongsToMany', 'hasOne', 'hasMany', 'belongsToArray'].includes(String(source.get('type'))))
      continue;
    const sourceOptions = object(source.get('options'));
    const targetOptions = object(target.get('options'));
    const sourceUi = object(sourceOptions.uiSchema);
    const targetUi = object(targetOptions.uiSchema);
    const options = {
      ...targetOptions,
      ...Object.fromEntries(
        ['precision', 'scale']
          .filter((key) => sourceOptions[key] !== undefined)
          .map((key) => [key, sourceOptions[key]]),
      ),
      uiSchema: {
        ...targetUi,
        ...sourceUi,
        title: targetUi.title || sourceUi.title,
        'x-component-props': { ...object(targetUi['x-component-props']), ...object(sourceUi['x-component-props']) },
      },
    };
    await target.update({ interface: source.get('interface'), options }, { transaction });
  }
}
