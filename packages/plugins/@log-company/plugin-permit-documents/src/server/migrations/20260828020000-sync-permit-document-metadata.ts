/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { FieldOptions } from '@nocobase/database';
import { Migration } from '@nocobase/server';
import { permitDocumentFields } from '../collections/permitDocuments';

const MANAGED_METADATA_FIELDS = new Set([
  'title',
  'document_type',
  'valid_from',
  'valid_until',
  'status',
  'product_information',
  'external_id',
  'external_status',
  'sync_status',
  'last_checked_at',
  'last_sync_error',
  'technical_regulations',
]);

interface FieldMetadataModel {
  update(values: Record<string, unknown>): Promise<unknown>;
}

interface FieldsMetadataRepository {
  findOne(options: { filter: { collectionName: string; name: string } }): Promise<FieldMetadataModel | null>;
  create(options: { values: Record<string, unknown> }): Promise<unknown>;
  destroy(options: { filter: { collectionName: string; name: string } }): Promise<number>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const repository = this.db.getRepository('fields') as unknown as FieldsMetadataRepository;
    for (const field of permitDocumentFields.filter((item) => MANAGED_METADATA_FIELDS.has(String(item.name)))) {
      await this.upsertFieldMetadata(repository, field);
    }
    await repository.destroy({ filter: { collectionName: 'permit_documents', name: 'technical_regulation' } });
    await this.ensureTechnicalRegulationIndexes();
  }

  async down(): Promise<void> {
    // Metadata and indexes are retained to keep user data and the upgraded UI schema safe.
  }

  private async upsertFieldMetadata(repository: FieldsMetadataRepository, field: FieldOptions): Promise<void> {
    const { name, type, interface: fieldInterface, ...options } = field;
    const fieldName = String(name);
    const existing = await repository.findOne({
      filter: { collectionName: 'permit_documents', name: fieldName },
    });
    if (!existing) {
      await repository.create({
        values: {
          collectionName: 'permit_documents',
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

  private async ensureTechnicalRegulationIndexes(): Promise<void> {
    if (this.db.sequelize.getDialect() !== 'postgres') {
      return;
    }
    await this.db.sequelize.query(
      `create unique index if not exists technical_regulations_fsa_id_unique
         on technical_regulations(fsa_id) where fsa_id is not null;
       create unique index if not exists technical_regulations_doc_num_unique
         on technical_regulations(doc_num);`,
    );
  }
}
