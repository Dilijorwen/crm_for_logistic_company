/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Model, Transaction } from 'sequelize';
import type { Plugin } from '@nocobase/server';
import type {
  ApplySyncResult,
  PermitDocumentIdentity,
  PermitDocumentRepository,
  PermitDocumentSnapshot,
  TechnicalRegulationCandidate,
  TechnicalRegulationRecord,
  TransactionContext,
} from '../../application/ports/PermitDocumentRepository';
import {
  isPermitDocumentStatus,
  isPermitDocumentSyncStatus,
  isPermitDocumentType,
} from '../../domain/permit-document/PermitDocumentPolicy';
import type { RegistryDocument } from '../../domain/permit-document/RegistryDocument';
import { RegistryError } from '../../domain/permit-document/RegistryErrors';

interface SnowflakeIdGenerator {
  generate(): string | number | bigint;
}

interface PermitDocumentRow {
  id: string | number | bigint;
  title: string;
  document_type: unknown;
  external_id: string | null;
  sync_status: unknown;
  status: unknown;
  last_checked_at: Date | string | null;
}

interface TechnicalRegulationRow {
  id: string | number | bigint;
  fsa_id: number | null;
  doc_num: string;
  name: string | null;
}

interface IdentifierRow {
  id: string | number | bigint;
}

export class NocoBasePermitDocumentRepository implements PermitDocumentRepository {
  constructor(private readonly plugin: Plugin) {}

  async findById(documentId: string): Promise<PermitDocumentSnapshot | null> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `select id, title, document_type, external_id, sync_status, status, last_checked_at
       from permit_documents where id = :documentId limit 1`,
      { replacements: { documentId } },
    )) as unknown as [PermitDocumentRow[], unknown];
    const row = rows[0];
    if (!row || !isPermitDocumentType(row.document_type) || !isPermitDocumentSyncStatus(row.sync_status)) {
      return null;
    }
    return {
      id: String(row.id),
      title: row.title,
      documentType: row.document_type,
      externalId: row.external_id,
      syncStatus: row.sync_status,
      status: isPermitDocumentStatus(row.status) ? row.status : null,
      lastCheckedAt: row.last_checked_at === null ? null : new Date(row.last_checked_at),
    };
  }

  async findTechnicalRegulationsByFsaIds(fsaIds: readonly number[]): Promise<TechnicalRegulationRecord[]> {
    if (fsaIds.length === 0) {
      return [];
    }
    const records = await this.plugin.db.getRepository('technical_regulations').find({
      filter: { fsa_id: { $in: [...fsaIds] } },
      fields: ['id', 'fsa_id', 'doc_num', 'name'],
    });
    return records.map((record: Model) => this.mapTechnicalRegulation(record.toJSON() as TechnicalRegulationRow));
  }

  async markPending(documentId: string): Promise<boolean> {
    const [, metadata] = (await this.plugin.db.sequelize.query(
      `update permit_documents
       set sync_status = 'PENDING', last_sync_error = null, "updatedAt" = :now
       where id = :documentId`,
      { replacements: { documentId, now: new Date() } },
    )) as unknown as [unknown, number | { rowCount?: number }];
    return this.affectedRows(metadata) > 0;
  }

  markNotFound(identity: PermitDocumentIdentity, checkedAt: Date): Promise<ApplySyncResult> {
    return this.updateIdentity(
      identity,
      {
        external_id: null,
        external_status: null,
        status: null,
        valid_from: null,
        valid_until: null,
        product_information: null,
        sync_status: 'NOT_FOUND',
        last_checked_at: checkedAt,
        last_sync_error: null,
      },
      true,
    );
  }

  markError(identity: PermitDocumentIdentity, checkedAt: Date, errorCode: string): Promise<ApplySyncResult> {
    return this.updateIdentity(identity, {
      sync_status: 'ERROR',
      last_checked_at: checkedAt,
      last_sync_error: errorCode,
    });
  }

  async applySuccess(
    identity: PermitDocumentIdentity,
    document: RegistryDocument,
    regulations: readonly TechnicalRegulationCandidate[],
    checkedAt: Date,
  ): Promise<ApplySyncResult> {
    return this.plugin.db.sequelize.transaction(async (transaction) => {
      const current = await this.lockIdentity(identity, transaction);
      if (current === 'MISSING' || current === 'STALE') {
        return current;
      }
      const regulationIds: string[] = [];
      for (const candidate of this.uniqueCandidates(regulations)) {
        regulationIds.push(await this.resolveTechnicalRegulation(candidate, transaction));
      }
      await this.plugin.db.sequelize.query(
        `update permit_documents
         set external_id = :externalId,
             external_status = :externalStatus,
             status = :status,
             valid_from = :validFrom,
             valid_until = :validUntil,
             product_information = :productInformation,
             sync_status = 'SUCCESS',
             last_checked_at = :checkedAt,
             last_sync_error = null,
             "updatedAt" = :checkedAt
         where id = :id and title = :title and document_type = :documentType`,
        {
          replacements: {
            id: identity.id,
            title: identity.title,
            documentType: identity.documentType,
            externalId: document.externalId,
            externalStatus: document.externalStatus,
            status: document.status,
            validFrom: document.validFrom,
            validUntil: document.validUntil,
            productInformation: document.productInformation,
            checkedAt,
          },
          transaction,
        },
      );
      await this.replaceTechnicalRegulations(identity.id, regulationIds, transaction);
      return 'UPDATED';
    });
  }

  async listPendingIds(limit: number): Promise<string[]> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `select id from permit_documents where sync_status = 'PENDING' order by "updatedAt" asc limit :limit`,
      { replacements: { limit } },
    )) as unknown as [IdentifierRow[], unknown];
    return rows.map((row) => String(row.id));
  }

  async listDailyDueIds(checkedBefore: Date, limit: number): Promise<string[]> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `select id
       from permit_documents
       where sync_status in ('PENDING', 'SUCCESS', 'ERROR')
         and (status is null or status <> 'terminated')
         and (last_checked_at is null or last_checked_at <= :checkedBefore)
       order by last_checked_at asc nulls first, id asc
       limit :limit`,
      { replacements: { checkedBefore, limit } },
    )) as unknown as [IdentifierRow[], unknown];
    return rows.map((row) => String(row.id));
  }

  async clearTechnicalRegulations(documentId: string, transaction?: TransactionContext): Promise<void> {
    await this.plugin.db.sequelize.query(`delete from document_technical_regulations where document_id = :documentId`, {
      replacements: { documentId },
      transaction: transaction as Transaction | undefined,
    });
  }

  private async updateIdentity(
    identity: PermitDocumentIdentity,
    values: Record<string, unknown>,
    clearRegulations = false,
  ): Promise<ApplySyncResult> {
    return this.plugin.db.sequelize.transaction(async (transaction) => {
      const current = await this.lockIdentity(identity, transaction);
      if (current === 'MISSING' || current === 'STALE') {
        return current;
      }
      const assignments = Object.keys(values).map((key) => `${key} = :${key}`);
      assignments.push('"updatedAt" = :updatedAt');
      await this.plugin.db.sequelize.query(`update permit_documents set ${assignments.join(', ')} where id = :id`, {
        replacements: { ...values, updatedAt: new Date(), id: identity.id },
        transaction,
      });
      if (clearRegulations) {
        await this.clearTechnicalRegulations(identity.id, transaction);
      }
      return 'UPDATED';
    });
  }

  private async lockIdentity(
    identity: PermitDocumentIdentity,
    transaction: Transaction,
  ): Promise<'UPDATED' | 'STALE' | 'MISSING'> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `select id, title, document_type from permit_documents where id = :id limit 1 for update`,
      { replacements: { id: identity.id }, transaction },
    )) as unknown as [Array<{ id: string | number | bigint; title: string; document_type: string }>, unknown];
    if (!rows[0]) {
      return 'MISSING';
    }
    return rows[0].title === identity.title && rows[0].document_type === identity.documentType ? 'UPDATED' : 'STALE';
  }

  private async resolveTechnicalRegulation(
    candidate: TechnicalRegulationCandidate,
    transaction: Transaction,
  ): Promise<string> {
    if (this.plugin.db.sequelize.getDialect() === 'postgres') {
      await this.plugin.db.sequelize.query('select pg_advisory_xact_lock(hashtext(:docNum))', {
        replacements: { docNum: candidate.docNum },
        transaction,
      });
    }
    const repository = this.plugin.db.getRepository('technical_regulations');
    const byDocNum = await repository.findOne({ filter: { doc_num: candidate.docNum }, transaction });
    const byFsaId =
      candidate.fsaId === null ? null : await repository.findOne({ filter: { fsa_id: candidate.fsaId }, transaction });
    if (byDocNum && byFsaId && String(byDocNum.get('id')) !== String(byFsaId.get('id'))) {
      throw new RegistryError(
        'TECHNICAL_REGULATION_CONFLICT',
        'Technical regulation identifiers point to different records.',
        false,
      );
    }
    const existing = byDocNum || byFsaId;
    if (existing) {
      if (String(existing.get('doc_num')) !== candidate.docNum) {
        throw new RegistryError('TECHNICAL_REGULATION_CONFLICT', 'FSA regulation number changed.', false);
      }
      const values: Record<string, unknown> = {};
      if (existing.get('fsa_id') == null && candidate.fsaId !== null) {
        values.fsa_id = candidate.fsaId;
      }
      if (!existing.get('name') && candidate.name) {
        values.name = candidate.name;
      }
      if (Object.keys(values).length > 0) {
        await existing.update(values, { transaction });
      }
      return String(existing.get('id'));
    }
    const created = await repository.create({
      values: { id: this.generateId(), fsa_id: candidate.fsaId, doc_num: candidate.docNum, name: candidate.name },
      transaction,
    });
    return String(created.get('id'));
  }

  private async replaceTechnicalRegulations(
    documentId: string,
    regulationIds: readonly string[],
    transaction: Transaction,
  ): Promise<void> {
    const repository = this.plugin.db.getRepository('document_technical_regulations');
    const existing = await repository.find({
      filter: { document_id: documentId },
      fields: ['technical_regulation_id'],
      transaction,
    });
    const currentIds = existing.map((record: Model) => String(record.get('technical_regulation_id'))).sort();
    const nextIds = [...regulationIds].sort();
    if (currentIds.length === nextIds.length && currentIds.every((id, index) => id === nextIds[index])) {
      return;
    }
    await repository.destroy({ filter: { document_id: documentId }, transaction });
    for (const technicalRegulationId of nextIds) {
      await repository.create({
        values: {
          id: this.generateId(),
          document_id: documentId,
          technical_regulation_id: technicalRegulationId,
        },
        transaction,
      });
    }
  }

  private uniqueCandidates(candidates: readonly TechnicalRegulationCandidate[]): TechnicalRegulationCandidate[] {
    const byDocNum = new Map<string, TechnicalRegulationCandidate>();
    for (const candidate of candidates) {
      const existing = byDocNum.get(candidate.docNum);
      if (existing && existing.fsaId !== null && candidate.fsaId !== null && existing.fsaId !== candidate.fsaId) {
        throw new RegistryError(
          'TECHNICAL_REGULATION_CONFLICT',
          'The same technical regulation number has different FSA identifiers.',
          false,
        );
      }
      byDocNum.set(candidate.docNum, {
        fsaId: existing?.fsaId ?? candidate.fsaId,
        docNum: candidate.docNum,
        name: existing?.name ?? candidate.name,
      });
    }
    return [...byDocNum.values()];
  }

  private mapTechnicalRegulation(row: TechnicalRegulationRow): TechnicalRegulationRecord {
    return { id: String(row.id), fsaId: row.fsa_id, docNum: row.doc_num, name: row.name };
  }

  private generateId(): string {
    const application = this.plugin.app as typeof this.plugin.app & { snowflakeIdGenerator: SnowflakeIdGenerator };
    return String(application.snowflakeIdGenerator.generate());
  }

  private affectedRows(metadata: number | { rowCount?: number }): number {
    return typeof metadata === 'number' ? metadata : metadata.rowCount || 0;
  }
}
