/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { LOGISTICS_COLLECTIONS, LOGISTICS_HISTORY_EVENT_LABELS } from '../../shared/logistics';

interface MetadataRecord {
  get(key: string): unknown;
}

interface FieldsMetadataRepository {
  findOne(options: { filter: { collectionName: string; name: string } }): Promise<MetadataRecord | null>;
  update(options: {
    filter: { collectionName: string; name: string };
    values: { uiSchema: Record<string, unknown> };
  }): Promise<unknown>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const fields = this.db.getRepository('fields') as unknown as FieldsMetadataRepository;
    const eventOptions = Object.entries(LOGISTICS_HISTORY_EVENT_LABELS).map(([value, label]) => ({ value, label }));
    for (const collectionName of [LOGISTICS_COLLECTIONS.runHistory, LOGISTICS_COLLECTIONS.shipmentHistory]) {
      const field = await fields.findOne({ filter: { collectionName, name: 'event_type' } });
      if (!field) {
        continue;
      }
      await fields.update({
        filter: { collectionName, name: 'event_type' },
        values: {
          uiSchema: {
            ...this.asRecord(field.get('uiSchema')),
            type: 'string',
            title: 'Событие',
            'x-component': 'Select',
            enum: eventOptions,
          },
        },
      });
    }
  }

  async down(): Promise<void> {
    // Event metadata is backward-compatible and intentionally preserved.
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
