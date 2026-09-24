/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { logisticsAssociationFields } from '../infrastructure/metadata/LogisticsAssociationFields';

interface CollectionsMetadataRepository {
  findOne(options: { filter: { name: string } }): Promise<unknown>;
}

interface FieldsMetadataRepository {
  findOne(options: { filter: { collectionName: string; name: string } }): Promise<unknown>;
  create(options: { values: Record<string, unknown> }): Promise<unknown>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const collections = this.db.getRepository('collections') as unknown as CollectionsMetadataRepository;
    const fields = this.db.getRepository('fields') as unknown as FieldsMetadataRepository;
    for (const definition of logisticsAssociationFields) {
      const target = String(definition.field.target);
      const targetExists = await collections.findOne({ filter: { name: target } });
      if (!targetExists) {
        throw new Error(`Для логистической связи отсутствует коллекция ${target}.`);
      }
      const exists = await fields.findOne({
        filter: { collectionName: definition.collectionName, name: String(definition.field.name) },
      });
      if (!exists) {
        await fields.create({
          values: { collectionName: definition.collectionName, ...definition.field },
        });
      }
    }
  }

  async down(): Promise<void> {
    // Preserve association metadata and user data.
  }
}
