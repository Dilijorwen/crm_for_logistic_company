/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';

interface MetadataRecord {
  get(key: string): unknown;
}

interface MetadataRepository {
  findOne(options: { filter: Record<string, unknown> }): Promise<MetadataRecord | null>;
  update(options: { filter: Record<string, unknown>; values: Record<string, unknown> }): Promise<unknown>;
}

const CONTRACT_FILTER = {
  importers: {
    id: { $eq: '{{$nForm.company.id}}' },
  },
};

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const repository = this.db.getRepository('fields') as unknown as MetadataRepository;
    const filter = { collectionName: 'shipments', name: 'contract_record' };
    const record = await repository.findOne({ filter });
    if (!record) {
      return;
    }

    const uiSchema = this.asRecord(record.get('uiSchema'));
    const componentProps = this.asRecord(uiSchema['x-component-props']);
    const service = this.asRecord(componentProps.service);
    const params = this.asRecord(service.params);
    await repository.update({
      filter,
      values: {
        uiSchema: {
          ...uiSchema,
          'x-component-props': {
            ...componentProps,
            service: {
              ...service,
              params: { ...params, filter: CONTRACT_FILTER },
            },
          },
        },
      },
    });
  }

  async down(): Promise<void> {
    // The company-scoped contract selector is a data-integrity rule and is intentionally preserved.
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
