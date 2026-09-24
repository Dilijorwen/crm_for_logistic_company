/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { NormalizeShipmentNumericFields } from '../NormalizeShipmentNumericFields';

describe('NormalizeShipmentNumericFields', () => {
  it('normalizes every double shipment field and ignores unrelated values', () => {
    const normalizer = new NormalizeShipmentNumericFields();

    expect(
      normalizer.execute({
        invoice_value: '1,0',
        customs_payments_amount: '2.5',
        eco_fee: '3,25',
        ktc_amount: 4.5,
        ntm_honest_sign_sum: null,
        goods_count: '6,0',
        invoice_number: 'INV-1',
      }),
    ).toEqual({
      invoice_value: 1,
      customs_payments_amount: 2.5,
      eco_fee: 3.25,
      ktc_amount: 4.5,
      ntm_honest_sign_sum: null,
      goods_count: 6,
    });
  });
});
