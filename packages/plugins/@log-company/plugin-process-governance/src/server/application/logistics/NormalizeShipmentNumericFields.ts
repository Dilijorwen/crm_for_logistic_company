/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { normalizeShipmentDecimal } from '../../domain/logistics/ShipmentDecimal';

const SHIPMENT_NUMERIC_FIELDS = [
  { name: 'invoice_value', label: 'Стоимость по инвойсу' },
  { name: 'customs_payments_amount', label: 'Сумма таможенных платежей' },
  { name: 'eco_fee', label: 'Экологический сбор' },
  { name: 'ktc_amount', label: 'Сумма КТС' },
  { name: 'ntm_honest_sign_sum', label: 'Сумма «Честного знака» НТМ' },
  { name: 'goods_count', label: 'Количество товаров' },
] as const;

export class NormalizeShipmentNumericFields {
  execute(values: Readonly<Record<string, unknown>>): Record<string, number | null> {
    const normalizedValues: Record<string, number | null> = {};
    for (const field of SHIPMENT_NUMERIC_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(values, field.name)) {
        continue;
      }
      const value = normalizeShipmentDecimal(values[field.name], field.label);
      if (value !== undefined) {
        normalizedValues[field.name] = value;
      }
    }
    return normalizedValues;
  }
}
