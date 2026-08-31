/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import {
  companyPermitDocumentsField,
  permitDocumentCompanyField,
} from '../infrastructure/metadata/permitDocumentAssociationFields';

const PERMIT_DOCUMENTS_COLLECTION = 'permit_documents';
const COMPANIES_COLLECTION = 'our_companies';

interface CollectionsMetadataRepository {
  findOne(options: { filter: { name: string } }): Promise<unknown>;
  db2cm?(name: string): Promise<void>;
}

interface FieldsMetadataRepository {
  findOne(options: { filter: { collectionName: string; name: string } }): Promise<unknown>;
  create(options: { values: Record<string, unknown> }): Promise<unknown>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const permitDocuments = this.db.getCollection(PERMIT_DOCUMENTS_COLLECTION);
    if (!permitDocuments) {
      throw new Error('The permit_documents collection is not loaded.');
    }
    await permitDocuments.sync({ alter: { drop: false } });

    const collectionsRepository = this.db.getRepository('collections') as unknown as CollectionsMetadataRepository;
    const permitDocumentsMetadata = await collectionsRepository.findOne({
      filter: { name: PERMIT_DOCUMENTS_COLLECTION },
    });
    if (!permitDocumentsMetadata) {
      if (!collectionsRepository.db2cm) {
        throw new Error('The collection metadata synchronization API is unavailable.');
      }
      await collectionsRepository.db2cm(PERMIT_DOCUMENTS_COLLECTION);
    }

    const companiesMetadata = await collectionsRepository.findOne({ filter: { name: COMPANIES_COLLECTION } });
    if (!companiesMetadata) {
      throw new Error('The permit documents plugin requires the our_companies collection.');
    }

    const fieldsRepository = this.db.getRepository('fields') as unknown as FieldsMetadataRepository;
    await this.createFieldIfMissing(fieldsRepository, PERMIT_DOCUMENTS_COLLECTION, permitDocumentCompanyField);
    await this.createFieldIfMissing(fieldsRepository, COMPANIES_COLLECTION, companyPermitDocumentsField);
  }

  async down(): Promise<void> {
    // Keep collection metadata and user data when the plugin is rolled back.
  }

  private async createFieldIfMissing(
    repository: FieldsMetadataRepository,
    collectionName: string,
    field: Record<string, unknown>,
  ): Promise<void> {
    const existing = await repository.findOne({ filter: { collectionName, name: String(field.name) } });
    if (existing) {
      return;
    }
    await repository.create({ values: { collectionName, ...field } });
  }
}
