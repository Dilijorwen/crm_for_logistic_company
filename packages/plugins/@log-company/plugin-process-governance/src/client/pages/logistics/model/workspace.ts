/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ShipmentRecord, TransportRunRecord } from './types';

export interface LogisticsWorkItem {
  id: string;
  run: TransportRunRecord;
  shipment: ShipmentRecord | null;
}

export interface LogisticsWorkspaceFilters {
  search: string;
  status: string | null;
  managerId: string | null;
  declarantId: string | null;
}

export type LogisticsWorkspaceView = 'primary' | 'manager' | 'declarant' | 'all';

export const EMPTY_LOGISTICS_WORKSPACE_FILTERS: LogisticsWorkspaceFilters = {
  search: '',
  status: null,
  managerId: null,
  declarantId: null,
};

export function buildLogisticsWorkItems(runs: TransportRunRecord[]): LogisticsWorkItem[] {
  return runs.flatMap<LogisticsWorkItem>((run) => {
    if (run.shipments.length === 0) {
      return [{ id: `${run.id}:unlinked`, run, shipment: null }];
    }
    return run.shipments.map((shipment) => ({ id: `${run.id}:${shipment.id}`, run, shipment }));
  });
}

export function filterLogisticsWorkItems(
  items: LogisticsWorkItem[],
  filters: LogisticsWorkspaceFilters,
): LogisticsWorkItem[] {
  const search = filters.search.trim().toLocaleLowerCase('ru-RU');

  return items.filter((item) => {
    if (filters.status && item.shipment?.status !== filters.status) {
      return false;
    }
    if (filters.managerId && !item.run.managers.some((manager) => manager.id === filters.managerId)) {
      return false;
    }
    if (filters.declarantId && !item.run.declarants.some((declarant) => declarant.id === filters.declarantId)) {
      return false;
    }
    if (!search) {
      return true;
    }

    return searchableValues(item).some((value) => value.toLocaleLowerCase('ru-RU').includes(search));
  });
}

function searchableValues(item: LogisticsWorkItem): string[] {
  const shipment = item.shipment;
  return [
    String(item.run.runNumber),
    item.run.registrationNumber,
    item.run.departureCity?.label || '',
    ...item.run.managers.map((manager) => manager.label),
    ...item.run.declarants.map((declarant) => declarant.label),
    shipment ? String(shipment.shipmentNumber) : '',
    shipment?.chineseClient?.label || '',
    shipment?.company?.label || '',
    shipment?.invoiceNumber || '',
    shipment?.declarationNumber || '',
    shipment?.applicationNumber || '',
    shipment?.managerComment || '',
  ];
}
