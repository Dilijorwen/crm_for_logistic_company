/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to https://www.nocobase.com/agreement.
 */

import type { SingleRecordResource } from '@nocobase/flow-engine';
import { cloneDeep, isEqual } from 'lodash';

type ShipmentRow = Record<string, unknown> & { id?: string | number };
const selectedByResource = new WeakMap<SingleRecordResource, Map<string, ShipmentRow>>();

const pendingSelection = new WeakSet<SingleRecordResource>();

export function setShipmentSelectionPending(resource: SingleRecordResource, pending: boolean): void {
  if (pending) pendingSelection.add(resource);
  else pendingSelection.delete(resource);
}

export function rememberSelectedShipments(
  resource: SingleRecordResource,
  current: ShipmentRow[] | undefined,
  selected: ShipmentRow[],
) {
  const knownIds = new Set((current ?? []).flatMap(({ id }) => (id == null ? [] : [String(id)])));
  const originals = selectedByResource.get(resource) ?? new Map<string, ShipmentRow>();
  for (const row of selected) {
    if (row.id != null && !knownIds.has(String(row.id))) originals.set(String(row.id), cloneDeep(row));
  }
  selectedByResource.set(resource, originals);
}

export function configureUnifiedShipmentSave(resource: SingleRecordResource) {
  resource.setSaveActionOptions({ params: { workspaceUnified: true } });
  const save = resource.save.bind(resource);
  resource.save = async (data, options) => {
    if (pendingSelection.has(resource)) throw new Error('Дождитесь загрузки выбранных поставок.');
    if (!Array.isArray(data?.shipments)) return save(data, options);
    const originals = new Map<string, ShipmentRow>(selectedByResource.get(resource));
    const stored: ShipmentRow[] | undefined = resource.getData()?.shipments;
    for (const row of stored ?? []) {
      if (row.id != null) originals.set(String(row.id), row);
    }
    const shipments = (data.shipments as ShipmentRow[]).map((row) => {
      if (row?.id == null) return row;
      const { id, __is_stored__, __is_new__, ...fields } = row;
      const original = originals.get(String(id));
      if (!original) return row;
      const edits = Object.entries(fields).filter(
        ([field, value]) => value !== undefined && !isEqual(value, original[field]),
      );
      return { id, ...Object.fromEntries(edits) };
    });
    return save({ ...data, shipments }, options);
  };
  resource.on('saved', () => selectedByResource.delete(resource));
}
