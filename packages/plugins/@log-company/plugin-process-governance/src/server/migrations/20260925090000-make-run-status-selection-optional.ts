/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';

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

function isRequiredRule(value: unknown): boolean {
  return asRecord(value).name === 'required';
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const fields = this.db.getRepository('fields') as unknown as FieldsMetadataRepository;
    const status = await fields.findOne({ filter: { collectionName: 'transport_runs', name: 'status' } });
    if (!status) {
      throw new Error('В коллекции transport_runs отсутствует поле status.');
    }

    const options = asRecord(status.get('options'));
    const uiSchema = asRecord(options.uiSchema);
    const validation = asRecord(options.validation);
    const { required: _required, ...optionalUiSchema } = uiSchema;
    const rules = Array.isArray(validation.rules) ? validation.rules.filter((rule) => !isRequiredRule(rule)) : [];

    await status.update({
      options: {
        ...options,
        validation: {
          ...validation,
          rules,
        },
        uiSchema: optionalUiSchema,
      },
    });
  }

  async down(): Promise<void> {
    // Keep the optional selection because restoring the UI requirement would contradict the server default.
  }
}
