/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import type { Transaction } from 'sequelize';
import type {
  NumberedPermitDocument,
  PermitDocumentNumberingRepository,
  PermitNumberingTransaction,
} from '../../application/ports/PermitDocumentNumberingRepository';
import { PermitDocumentNumberingError } from '../../domain/permit-document/PermitDocumentNumbering';

export class NocoBasePermitDocumentNumberingRepository implements PermitDocumentNumberingRepository {
  constructor(private readonly plugin: Plugin) {}

  async lock(transaction: PermitNumberingTransaction): Promise<void> {
    if (this.plugin.db.sequelize.getDialect() === 'postgres') {
      await this.plugin.db.sequelize.query('select pg_advisory_xact_lock(hashtext(:key))', {
        replacements: { key: 'log-company.permit-document-numbers' },
        transaction: transaction as Transaction,
      });
    }
  }

  async findById(id: string, transaction: PermitNumberingTransaction): Promise<NumberedPermitDocument | null> {
    const [rows] = await this.plugin.db.sequelize.query(
      'select id, internal_number, related_document_id from permit_documents where id = :id',
      { replacements: { id }, transaction: transaction as Transaction },
    );
    const row = (rows as Array<{ id: string; internal_number: string; related_document_id: string | null }>)[0];
    return row
      ? {
          id: String(row.id),
          internalNumber: String(row.internal_number),
          relatedDocumentId: row.related_document_id == null ? null : String(row.related_document_id),
        }
      : null;
  }

  async nextFreeNumber(transaction: PermitNumberingTransaction): Promise<string> {
    const [rows] = await this.plugin.db.sequelize.query(
      `select min(candidate) as next_number
       from (select 1 as candidate union select internal_number + 1 from permit_documents) candidates
       where not exists (select 1 from permit_documents where internal_number = candidates.candidate)`,
      { transaction: transaction as Transaction },
    );
    return String((rows as Array<{ next_number: string | number }>)[0].next_number);
  }

  async completePair(
    documentId: string,
    relatedDocumentId: string,
    transaction: PermitNumberingTransaction,
  ): Promise<void> {
    const [rows] = await this.plugin.db.sequelize.query(
      `update permit_documents set related_document_id = :documentId, "updatedAt" = CURRENT_TIMESTAMP
       where id = :relatedDocumentId and related_document_id is null
       returning id`,
      { replacements: { documentId, relatedDocumentId }, transaction: transaction as Transaction },
    );
    if ((rows as unknown[]).length !== 1) {
      throw new PermitDocumentNumberingError(
        'RELATED_DOCUMENT_ALREADY_PAIRED',
        'У выбранного документа уже есть связанный документ.',
      );
    }
  }
}
