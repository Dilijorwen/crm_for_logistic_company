/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createHash } from 'node:crypto';
import type { Database, Model, Transaction } from '@nocobase/database';

export const ARCHIVED_SHIPMENT_FIELDS = new Set([
  'route_delivery_number',
  'declaration_release_date',
  'application_release_date',
]);
const COLLECTIONS = ['shipments', 'logistics_work_items'];

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function withoutNtm(title: string): string {
  return title.replace(/^НТМ\s*:\s*/u, '').replace(/\s+НТМ$/u, '');
}
function renameLabels(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(renameLabels);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      ['title', 'label', 'tooltip'].includes(key) && typeof item === 'string' ? withoutNtm(item) : renameLabels(item),
    ]),
  );
}
function retiredPath(value: unknown): boolean {
  return typeof value === 'string' && value.split('.').some((part) => ARCHIVED_SHIPMENT_FIELDS.has(part));
}

/** Preserve remaining predicates and their logical operators in both native and saved-template filters. */
function cleanFilter(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanFilter).filter((item) => item !== undefined);
  if (!value || typeof value !== 'object') return value;
  const input = object(value);
  if (retiredPath(input.path)) return undefined;
  const result = Object.fromEntries(
    Object.entries(input)
      .filter(([key]) => !retiredPath(key))
      .map(([key, item]) => [key, cleanFilter(item)])
      .filter(([, item]) => item !== undefined),
  );
  if (typeof input.logic === 'string' && Array.isArray(result.items) && !result.items.length) return undefined;
  for (const key of ['$and', '$or']) {
    if (Array.isArray(result[key]) && !result[key].length) delete result[key];
  }
  return Object.keys(result).length ? result : undefined;
}
function cleanColumnSettings(value: unknown, removed: Set<string>): Record<string, unknown> {
  const settings = object(value);
  return {
    ...settings,
    ...Object.fromEntries(
      ['columnOrder', 'hiddenColumnUids']
        .filter((key) => Array.isArray(settings[key]))
        .map((key) => [key, (settings[key] as unknown[]).filter((uid) => !removed.has(String(uid)))]),
    ),
    ...(settings.columnWidths
      ? {
          columnWidths: Object.fromEntries(
            Object.entries(object(settings.columnWidths)).filter(([uid]) => !removed.has(uid)),
          ),
        }
      : {}),
  };
}
function cleanOptions(value: unknown, removed: Set<string>): unknown {
  if (Array.isArray(value)) return value.map((item) => cleanOptions(item, removed));
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'filter') result[key] = cleanFilter(item) ?? {};
    else if (key === 'searchableFieldNames' && Array.isArray(item))
      result[key] = item.filter((name) => !retiredPath(name));
    else if (key === 'sort' && Array.isArray(item))
      result[key] = item.filter(
        (entry) => !retiredPath(typeof entry === 'string' ? entry.replace(/^-/, '') : object(entry).field),
      );
    else if (key === 'grid' && object(item).rows && !Array.isArray(object(item).rows)) {
      const grid = object(item);
      const sizes = object(grid.sizes);
      const rows: Record<string, unknown> = {};
      const nextSizes: Record<string, unknown> = {};
      for (const [row, cells] of Object.entries(object(grid.rows))) {
        if (!Array.isArray(cells)) {
          rows[row] = cells;
          continue;
        }
        const remaining = cells
          .map((cell, index) => ({
            cell: Array.isArray(cell) ? cell.filter((uid) => !removed.has(String(uid))) : cell,
            index,
          }))
          .filter(({ cell }) => !Array.isArray(cell) || cell.length);
        if (!remaining.length) continue;
        rows[row] = remaining.map(({ cell }) => cell);
        const rowSizes = sizes[row];
        if (Array.isArray(rowSizes)) nextSizes[row] = remaining.map(({ index }) => rowSizes[index]);
      }
      result[key] = { ...grid, rows, ...(grid.sizes ? { sizes: nextSizes } : {}) };
    } else result[key] = cleanOptions(item, removed);
  }
  return result;
}

/** Archive UI metadata only. No business rows, SQL columns, associations or ACL grants are deleted. */
export async function simplifyShipmentFields(db: Database, outerTransaction?: Transaction): Promise<void> {
  async function apply(transaction: Transaction) {
    if (db.getCollection('fields')) {
      const fields = await db
        .getRepository('fields')
        .find({ filter: { collectionName: { $in: COLLECTIONS } }, transaction });
      for (const field of fields) {
        const name = String(field.get('name'));
        const options = object(field.get('options'));
        const uiSchema = object(options.uiSchema);
        let next = options;
        if (ARCHIVED_SHIPMENT_FIELDS.has(name))
          next = { ...options, hidden: true, uiSchema: { ...uiSchema, 'x-hidden': true } };
        else if (name.startsWith('ntm_')) next = { ...options, uiSchema: renameLabels(uiSchema) };
        if (JSON.stringify(next) !== JSON.stringify(options)) await field.update({ options: next }, { transaction });
      }
    }
    if (!db.getCollection('flowModels')) return;
    const repository = db.getRepository('flowModels');
    const models: Model[] = await repository.find({ transaction });
    const byUid = new Map(models.map((model) => [String(model.get('uid')), model]));
    function context(uid: string): { shipment: boolean; fieldPath: string } {
      const visited = new Set<string>();
      let fieldPath = '';
      while (byUid.has(uid) && !visited.has(uid)) {
        visited.add(uid);
        const options = object(byUid.get(uid)?.get('options'));
        const steps = object(options.stepParams);
        const binding = object(object(steps.fieldSettings).init);
        if (!fieldPath && typeof binding.fieldPath === 'string') fieldPath = binding.fieldPath;
        for (const source of [binding, object(object(steps.resourceSettings).init)]) {
          if (source.dataSourceKey && source.dataSourceKey !== 'main') return { shipment: false, fieldPath };
          if (COLLECTIONS.includes(String(source.collectionName))) return { shipment: true, fieldPath };
          const association = typeof source.associationName === 'string' ? source.associationName : '';
          const parts = association.split('.');
          const collectionName = parts.length > 1 ? parts[0] : String(source.collectionName);
          const name = association ? parts[parts.length - 1] : String(binding.fieldPath || '').split('.')[0];
          const field = db.getCollection(collectionName)?.getField(name);
          if (field?.options.target === 'shipments') return { shipment: true, fieldPath };
        }
        uid = String(options.parentId);
      }
      return { shipment: false, fieldPath };
    }
    const affected = new Set(
      models.filter((model) => context(String(model.get('uid'))).shipment).map((model) => String(model.get('uid'))),
    );
    const removed = new Set(
      models
        .filter((model) => {
          const current = context(String(model.get('uid')));
          return current.shipment && retiredPath(current.fieldPath);
        })
        .map((model) => String(model.get('uid'))),
    );
    for (const model of models) {
      const uid = String(model.get('uid'));
      if (!affected.has(uid) || removed.has(uid)) continue;
      const options = model.get('options');
      const cleaned = cleanOptions(options, removed);
      const next = context(uid)
        .fieldPath.split('.')
        .some((part) => part.startsWith('ntm_'))
        ? renameLabels(cleaned)
        : cleaned;
      if (JSON.stringify(next) !== JSON.stringify(options))
        await model.update({ options: next }, { transaction, hooks: false });
    }
    // Remove roots with the native repository so closure paths and descendants are removed together.
    for (const uid of removed) {
      if (removed.has(String(object(byUid.get(uid)?.get('options')).parentId))) continue;
      await (
        repository as unknown as {
          remove(uid: string, options: { transaction: Transaction }): Promise<unknown>;
        }
      ).remove(uid, { transaction });
    }
    for (const collection of COLLECTIONS) {
      for (const name of ARCHIVED_SHIPMENT_FIELDS) {
        removed.add(
          `lc_field_${createHash('sha256')
            .update(JSON.stringify(['main', collection, name]))
            .digest('hex')}`,
        );
      }
    }
    for (const name of ['lc_table_personalizations', 'lc_table_filter_templates']) {
      if (!db.getCollection(name)) continue;
      const rows = await db.getRepository(name).find({ transaction });
      for (const row of rows) {
        if (!affected.has(String(row.get('tableUid')))) continue;
        const key = name === 'lc_table_personalizations' ? 'settings' : 'columnSettings';
        const previous = row.get(key);
        const settings = cleanColumnSettings(previous, removed);
        const previousFilter = row.get('filter');
        const filter = cleanFilter(previousFilter) ?? { logic: '$and', items: [] };
        const changed =
          JSON.stringify(settings) !== JSON.stringify(previous) ||
          (name === 'lc_table_filter_templates' && JSON.stringify(filter) !== JSON.stringify(previousFilter));
        if (changed)
          await row.update(
            {
              [key]: settings,
              ...(name === 'lc_table_filter_templates' ? { filter, revision: Number(row.get('revision')) + 1 } : {}),
            },
            { transaction },
          );
      }
    }
  }
  if (outerTransaction) await apply(outerTransaction);
  else await db.sequelize.transaction(apply);
}
