/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

const EMPTY_DISPLAY_PART = '—';

export interface ShipmentDisplayNameParts {
  shipmentNumber: unknown;
  clientName: unknown;
  invoiceNumber: unknown;
  applicationNumber: unknown;
  declarationNumber: unknown;
}

function normalizeDisplayPart(value: unknown): string {
  if (value === null || value === undefined) {
    return EMPTY_DISPLAY_PART;
  }
  const normalized = String(value).trim();
  return normalized || EMPTY_DISPLAY_PART;
}

export function buildShipmentDisplayName(parts: ShipmentDisplayNameParts): string {
  return [parts.shipmentNumber, parts.clientName, parts.invoiceNumber, parts.applicationNumber, parts.declarationNumber]
    .map(normalizeDisplayPart)
    .join('/');
}
