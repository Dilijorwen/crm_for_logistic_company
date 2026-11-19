/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { extractIdentifier, uniqueIdentifiers, type EntityId } from '../shared/Identifiers';
import { LogisticsError } from './LogisticsError';

export function requireShipmentChineseClients(value: unknown): EntityId[] {
  const values = Array.isArray(value) ? value : [value];
  if (!values.length || values.some((item) => extractIdentifier(item) === null)) {
    throw new LogisticsError('INVALID_SHIPMENT_CLIENTS', 'Выберите хотя бы одного китайского клиента.');
  }
  return uniqueIdentifiers(values);
}
