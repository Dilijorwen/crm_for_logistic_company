/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { CatalogFolder, CatalogItem, CatalogId } from './DocumentsCatalogApi';

export function catalogIdentifier(value: unknown): CatalogId | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value)) return value;
}

export function runCatalogTitle(row: Record<string, unknown>, id: CatalogId): string {
  const vehicle = (row.vehicle as { registration_number?: unknown } | null)?.registration_number;
  const suffix = typeof vehicle === 'string' && vehicle.trim() ? ` - ${vehicle.trim()}` : '';
  return `Рейс №${row.run_number ?? id}${suffix}`;
}

const months = new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' });
const permitStatuses: Record<string, string> = {
  valid: 'Действителен',
  suspended: 'Приостановлен',
  terminated: 'Прекращен',
};
const permitTypes: Record<string, string> = {
  declaration_of_conformity: 'ДС',
  certificate_of_conformity: 'СС',
  state_registration_certificate: 'СГР',
};

export function runCatalogFolders(rows: Record<string, unknown>[]): CatalogFolder[] {
  const periods = new Map<string, CatalogItem[]>();
  for (const row of rows) {
    const id = catalogIdentifier(row.id);
    if (id === undefined) continue;
    const dates = (Array.isArray(row.shipments) ? row.shipments : []).flatMap((shipment: unknown) => {
      const createdAt = (shipment as { createdAt?: unknown } | null)?.createdAt;
      return typeof createdAt === 'string' && Number.isFinite(Date.parse(createdAt)) ? [Date.parse(createdAt)] : [];
    });
    const period = dates.length ? new Date(Math.min(...dates)).toISOString().slice(0, 7) : '';
    const items = periods.get(period) || [];
    items.push({ id, title: runCatalogTitle(row, id) });
    periods.set(period, items);
  }

  const years = new Map<string, CatalogFolder & { children: CatalogFolder[] }>();
  for (const period of [...periods.keys()].sort().reverse()) {
    if (!period) continue;
    const year = period.slice(0, 4);
    const group = years.get(year) || { id: year, title: year, children: [] };
    const month = months.format(new Date(`${period}-01T00:00:00Z`));
    group.children.push({ id: period, title: month[0].toUpperCase() + month.slice(1), items: periods.get(period) });
    years.set(year, group);
  }
  const folders: CatalogFolder[] = Array.from(years.values());
  const undated = periods.get('');
  if (undated) folders.push({ id: 'undated', title: 'Без даты поставки', items: undated });
  return folders;
}

export function permitCatalogFolders(rows: Record<string, unknown>[]): CatalogFolder[] {
  const byStatus = new Map<string, Map<CatalogId, Map<string, CatalogId[]>>>();
  for (const row of rows) {
    const id = catalogIdentifier(row.id);
    if (id === undefined) continue;
    const status = String(row.status);
    const statusKey = Object.prototype.hasOwnProperty.call(permitStatuses, status) ? status : 'unspecified';
    const number = String(catalogIdentifier(row.internal_number) ?? id);
    const typeKey = String(row.document_type);
    const type = Object.prototype.hasOwnProperty.call(permitTypes, typeKey) ? permitTypes[typeKey] : 'Без типа';
    const byNumber = byStatus.get(statusKey) || new Map<CatalogId, Map<string, CatalogId[]>>();
    const byType = byNumber.get(number) || new Map<string, CatalogId[]>();
    byType.set(type, [...(byType.get(type) || []), id]);
    byNumber.set(number, byType);
    byStatus.set(statusKey, byNumber);
  }
  return [...Object.keys(permitStatuses), 'unspecified'].flatMap((status) => {
    const byNumber = byStatus.get(status);
    if (!byNumber) return [];
    const children = [...byNumber].map(
      ([id, byType]): CatalogFolder => ({
        id: String(id),
        title: String(id),
        ...(byType.size === 1
          ? { attachments: [...byType.values()][0] }
          : { children: [...byType].map(([type, attachments]) => ({ id: type, title: type, attachments })) }),
      }),
    );
    return [{ id: status, title: permitStatuses[status] || 'Без статуса', children }];
  });
}
