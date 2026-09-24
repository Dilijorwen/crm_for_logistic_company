/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';

const SHIPMENT_DECIMAL_FIELDS = [
  'invoice_value',
  'customs_payments_amount',
  'eco_fee',
  'ktc_amount',
  'ntm_honest_sign_sum',
  'goods_count',
] as const;

interface FieldMetadataModel {
  get(name: string): unknown;
  update(values: Record<string, unknown>): Promise<unknown>;
}

interface FieldsMetadataRepository {
  findOne(options: { filter: { collectionName: string; name: string } }): Promise<FieldMetadataModel | null>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const fields = this.db.getRepository('fields') as unknown as FieldsMetadataRepository;
    for (const fieldName of SHIPMENT_DECIMAL_FIELDS) {
      const field = await fields.findOne({ filter: { collectionName: 'shipments', name: fieldName } });
      if (!field) {
        throw new Error(`В коллекции shipments отсутствует числовое поле ${fieldName}.`);
      }
      const options = asRecord(field.get('options'));
      const uiSchema = asRecord(options.uiSchema);
      const componentProps = asRecord(uiSchema['x-component-props']);
      await field.update({
        options: {
          ...options,
          uiSchema: {
            ...uiSchema,
            'x-component-props': {
              ...componentProps,
              decimalSeparator: ',',
            },
          },
        },
      });
    }
  }

  async down(): Promise<void> {
    // Keep comma support because removing it would change already documented input behavior.
  }
}
