/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { TRANSPORT_TYPES, type TransportType } from '../../../shared/transport';
import { LogisticsError } from './LogisticsError';

export function requireTransportType(value: unknown): TransportType {
  if (typeof value === 'string' && TRANSPORT_TYPES.some((type) => type === value)) return value as TransportType;
  throw new LogisticsError(
    'INVALID_TRANSPORT_TYPE',
    'Выберите тип перевозки: автомобильная, железнодорожная, авиационная или морская.',
  );
}
