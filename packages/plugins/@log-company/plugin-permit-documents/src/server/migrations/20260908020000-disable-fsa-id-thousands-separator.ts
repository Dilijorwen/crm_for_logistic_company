/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { technicalRegulationFsaIdField } from '../collections/technicalRegulations';

const TECHNICAL_REGULATIONS_COLLECTION = 'technical_regulations';

interface FieldMetadataModel {
  update(values: Record<string, unknown>): Promise<unknown>;
}

interface FieldsMetadataRepository {
  findOne(options: { filter: { collectionName: string; name: string } }): Promise<FieldMetadataModel | null>;
  create(options: { values: Record<string, unknown> }): Promise<unknown>;
}

export default class DisableFsaIdThousandsSeparator extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const { name, type, interface: fieldInterface, ...options } = technicalRegulationFsaIdField;
    const fieldName = String(name);
    const repository = this.db.getRepository('fields') as unknown as FieldsMetadataRepository;
    const existing = await repository.findOne({
      filter: { collectionName: TECHNICAL_REGULATIONS_COLLECTION, name: fieldName },
    });

    if (!existing) {
      await repository.create({
        values: {
          collectionName: TECHNICAL_REGULATIONS_COLLECTION,
          name: fieldName,
          type,
          interface: fieldInterface,
          ...options,
        },
      });
      return;
    }

    await existing.update({ type, interface: fieldInterface, options });
  }

  async down(): Promise<void> {
    // The display format is retained because it does not change stored data.
  }
}
