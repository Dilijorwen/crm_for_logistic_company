/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import type { Transaction } from '@nocobase/database';
import { ProcessDocumentsError } from '../../../domain/documents/DocumentErrors';
import type { DocumentScope } from '../../../domain/documents/DocumentScope';
import type {
  CreateDocumentRecordInput,
  CreateFolderRecordInput,
  DocumentFolderRecord,
  ProcessDocumentRecord,
  ProcessDocumentsRepository,
  TransactionContext,
} from '../../../application/ports/ProcessDocumentsRepository';

import type { CompanyDocumentArea, FolderAccess } from '../../../../contracts/processDocuments';

const SHIPMENTS_COLLECTION = 'shipments';
const FOLDERS_COLLECTION = 'process_document_folders';
const DOCUMENTS_COLLECTION = 'process_documents';

interface FolderRow {
  access_grants?: FolderAccess | null;
  id: string | number | bigint;
  title: string;
  shipment_id: string | number | bigint | null;
  draft_token: string | null;
  company_id?: string | number | null;
  company_area?: CompanyDocumentArea | null;
  transport_run_id?: string | number | null;
  parent_folder_id: string | number | bigint | null;
  createdById: string | number | bigint | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  author?: string | null;
}

interface DocumentRow {
  id: string | number | bigint;
  title: string;
  original_filename: string;
  shipment_id: string | number | bigint | null;
  draft_token: string | null;
  company_id?: string | number | null;
  company_area?: CompanyDocumentArea | null;
  transport_run_id?: string | number | null;
  folder_id: string | number | bigint | null;
  storage_key: string;
  mime_type: string | null;
  file_size: string | number | bigint | null;
  createdById: string | number | bigint | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  author?: string | null;
}

export class NocoBaseProcessDocumentsRepository implements ProcessDocumentsRepository {
  constructor(private readonly plugin: Plugin) {}

  async withTransaction<T>(work: (transaction: TransactionContext) => Promise<T>): Promise<T> {
    return this.plugin.db.sequelize.transaction((transaction) => work(transaction));
  }

  async lockCompanyFolders(companyId: string, transaction: TransactionContext): Promise<void> {
    await this.plugin.db.sequelize.query('select id from our_companies where id = :companyId for update', {
      replacements: { companyId },
      transaction: this.asTransaction(transaction),
    });
  }

  async shipmentExists(shipmentId: string, transaction?: TransactionContext): Promise<boolean> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `select id from ${SHIPMENTS_COLLECTION} where id = :shipmentId limit 1${transaction ? ' for key share' : ''}`,
      {
        replacements: { shipmentId },
        transaction: this.asTransaction(transaction),
      },
    )) as [Array<{ id: string }>, unknown];
    return rows.length > 0;
  }

  async draftHasRecordsOwnedByOther(draftToken: string, actorId: string): Promise<boolean> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        select 1
        from (
          select "createdById" from ${FOLDERS_COLLECTION} where shipment_id is null and draft_token = :draftToken
          union all
          select "createdById" from ${DOCUMENTS_COLLECTION} where shipment_id is null and draft_token = :draftToken
        ) draft_records
        where "createdById" is null or "createdById" <> :actorId
        limit 1
      `,
      { replacements: { draftToken, actorId } },
    )) as [Array<{ value: number }>, unknown];
    return rows.length > 0;
  }

  async findFolderById(id: string, transaction?: TransactionContext): Promise<DocumentFolderRecord | null> {
    const [rows] = (await this.plugin.db.sequelize.query(`select * from ${FOLDERS_COLLECTION} where id = :id limit 1`, {
      replacements: { id },
      transaction: this.asTransaction(transaction),
    })) as [FolderRow[], unknown];
    return rows[0] ? this.mapFolder(rows[0]) : null;
  }

  async findDocumentById(id: string, transaction?: TransactionContext): Promise<ProcessDocumentRecord | null> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `select * from ${DOCUMENTS_COLLECTION} where id = :id limit 1`,
      { replacements: { id }, transaction: this.asTransaction(transaction) },
    )) as [DocumentRow[], unknown];
    return rows[0] ? this.mapDocument(rows[0]) : null;
  }

  async listFolders(
    scope: DocumentScope,
    parentFolderId: string | null,
    transaction?: TransactionContext,
  ): Promise<DocumentFolderRecord[]> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        select f.*, coalesce(u.nickname, u.username, '') as author
        from ${FOLDERS_COLLECTION} f
        left join users u on u.id = f."createdById"
        where ${this.scopePredicate(scope, 'f')}
          and ((:parentFolderId is null and f.parent_folder_id is null) or f.parent_folder_id = :parentFolderId)
        order by f.title asc, f.id asc
      `,
      {
        replacements: { ...this.scopeReplacements(scope), parentFolderId },
        transaction: this.asTransaction(transaction),
      },
    )) as [FolderRow[], unknown];
    return rows.map((row) => this.mapFolder(row));
  }

  async listDocuments(scope: DocumentScope, folderId: string | null): Promise<ProcessDocumentRecord[]> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        select d.*, coalesce(u.nickname, u.username, '') as author
        from ${DOCUMENTS_COLLECTION} d
        left join users u on u.id = d."createdById"
        where ${this.scopePredicate(scope, 'd')}
          and ((:folderId is null and d.folder_id is null) or d.folder_id = :folderId)
        order by d.title asc, d.id asc
      `,
      { replacements: { ...this.scopeReplacements(scope), folderId } },
    )) as [DocumentRow[], unknown];
    return rows.map((row) => this.mapDocument(row));
  }

  async listChildFolders(
    scope: DocumentScope,
    parentFolderId: string,
    transaction?: TransactionContext,
  ): Promise<DocumentFolderRecord[]> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        select *
        from ${FOLDERS_COLLECTION}
        where parent_folder_id = :parentFolderId and ${this.scopePredicate(scope)}
      `,
      {
        replacements: { ...this.scopeReplacements(scope), parentFolderId },
        transaction: this.asTransaction(transaction),
      },
    )) as [FolderRow[], unknown];
    return rows.map((row) => this.mapFolder(row));
  }

  async listFolderTitles(
    scope: DocumentScope,
    parentFolderId: string | null,
    transaction?: TransactionContext,
  ): Promise<string[]> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        select title
        from ${FOLDERS_COLLECTION}
        where ${this.scopePredicate(scope)}
          and ((:parentFolderId is null and parent_folder_id is null) or parent_folder_id = :parentFolderId)
      `,
      {
        replacements: { ...this.scopeReplacements(scope), parentFolderId },
        transaction: this.asTransaction(transaction),
      },
    )) as [Array<{ title: string }>, unknown];
    return rows.map((row) => String(row.title));
  }

  async listDocumentTitles(
    scope: DocumentScope,
    folderId: string | null,
    transaction?: TransactionContext,
  ): Promise<string[]> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        select title
        from ${DOCUMENTS_COLLECTION}
        where ${this.scopePredicate(scope)}
          and ((:folderId is null and folder_id is null) or folder_id = :folderId)
      `,
      {
        replacements: { ...this.scopeReplacements(scope), folderId },
        transaction: this.asTransaction(transaction),
      },
    )) as [Array<{ title: string }>, unknown];
    return rows.map((row) => String(row.title));
  }

  async listDocumentsInFolders(
    scope: DocumentScope,
    folderIds: string[],
    transaction?: TransactionContext,
  ): Promise<ProcessDocumentRecord[]> {
    if (!folderIds.length) {
      return [];
    }
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        select *
        from ${DOCUMENTS_COLLECTION}
        where folder_id in (:folderIds) and ${this.scopePredicate(scope)}
      `,
      {
        replacements: { ...this.scopeReplacements(scope), folderIds },
        transaction: this.asTransaction(transaction),
      },
    )) as [DocumentRow[], unknown];
    return rows.map((row) => this.mapDocument(row));
  }

  async listDocumentsByShipmentId(
    shipmentId: string,
    transaction?: TransactionContext,
  ): Promise<ProcessDocumentRecord[]> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `select * from ${DOCUMENTS_COLLECTION} where shipment_id = :shipmentId order by id asc`,
      {
        replacements: { shipmentId },
        transaction: this.asTransaction(transaction),
      },
    )) as [DocumentRow[], unknown];
    return rows.map((row) => this.mapDocument(row));
  }

  async createFolder(input: CreateFolderRecordInput, transaction?: TransactionContext): Promise<DocumentFolderRecord> {
    const now = new Date();
    const shipmentId = input.scope.mode === 'shipment' ? input.scope.shipmentId : null;
    const companyId = 'companyId' in input.scope ? input.scope.companyId : null;
    const companyArea = input.scope.mode === 'company' ? input.scope.companyArea ?? null : null;
    const runId = input.scope.mode === 'run' ? input.scope.runId : null;
    const draftToken = input.scope.mode === 'draft' ? input.scope.draftToken : null;
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        insert into ${FOLDERS_COLLECTION}
          (id, title, shipment_id, draft_token, company_id, company_area, transport_run_id, parent_folder_id, "createdAt", "updatedAt", "createdById", "updatedById")
        values
          (:id, :title, :shipmentId, :draftToken, :companyId, :companyArea, :runId, :parentFolderId, :now, :now, :actorId, :actorId)
        returning *
      `,
      {
        replacements: {
          id: input.id,
          title: input.title,
          shipmentId,
          draftToken,
          companyId,
          companyArea,
          runId,
          parentFolderId: input.parentFolderId,
          actorId: input.actorId,
          now,
        },
        transaction: this.asTransaction(transaction),
      },
    )) as [FolderRow[], unknown];
    return this.mapFolder(rows[0]);
  }

  async createDocument(
    input: CreateDocumentRecordInput,
    transaction?: TransactionContext,
  ): Promise<ProcessDocumentRecord> {
    const now = new Date();
    const shipmentId = input.scope.mode === 'shipment' ? input.scope.shipmentId : null;
    const companyId = 'companyId' in input.scope ? input.scope.companyId : null;
    const companyArea = input.scope.mode === 'company' ? input.scope.companyArea ?? null : null;
    const runId = input.scope.mode === 'run' ? input.scope.runId : null;
    const draftToken = input.scope.mode === 'draft' ? input.scope.draftToken : null;
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        insert into ${DOCUMENTS_COLLECTION}
          (
            id, title, original_filename, shipment_id, draft_token, company_id, company_area, transport_run_id, folder_id, storage_key, mime_type,
            file_size, "createdAt", "updatedAt", "createdById", "updatedById"
          )
        values
          (
            :id, :title, :originalFilename, :shipmentId, :draftToken, :companyId, :companyArea, :runId, :folderId, :storageKey, :mimeType,
            :fileSize, :now, :now, :actorId, :actorId
          )
        returning *
      `,
      {
        replacements: {
          id: input.id,
          title: input.title,
          originalFilename: input.originalFilename,
          shipmentId,
          draftToken,
          companyId,
          companyArea,
          runId,
          folderId: input.folderId,
          storageKey: input.storageKey,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          actorId: input.actorId,
          now,
        },
        transaction: this.asTransaction(transaction),
      },
    )) as [DocumentRow[], unknown];
    return this.mapDocument(rows[0]);
  }

  async setFolderGrants(id: string, grants: FolderAccess | null): Promise<void> {
    const [rows] = await this.plugin.db.sequelize.query(
      `update ${FOLDERS_COLLECTION} set access_grants = cast(:grants as jsonb), "updatedAt" = now() where id = :id returning id`,
      { replacements: { id, grants: grants === null ? null : JSON.stringify(grants) } },
    );
    if (!rows.length) {
      throw new ProcessDocumentsError('FOLDER_NOT_FOUND', 'Папка больше не существует.');
    }
  }

  async renameEntry(
    kind: 'folder' | 'file',
    id: string,
    title: string,
    transaction: TransactionContext,
  ): Promise<void> {
    const collection = kind === 'folder' ? FOLDERS_COLLECTION : DOCUMENTS_COLLECTION;
    const [rows] = await this.plugin.db.sequelize.query(
      `update ${collection} set title = :title, "updatedAt" = now() where id = :id returning id`,
      { replacements: { id, title }, transaction: this.asTransaction(transaction) },
    );
    if (!rows.length) {
      throw new ProcessDocumentsError(
        kind === 'folder' ? 'FOLDER_NOT_FOUND' : 'DOCUMENT_NOT_FOUND',
        'Файл или папка больше не существует.',
      );
    }
  }

  async deleteFolder(id: string, transaction?: TransactionContext): Promise<void> {
    await this.plugin.db.sequelize.query(`delete from ${FOLDERS_COLLECTION} where id = :id`, {
      replacements: { id },
      transaction: this.asTransaction(transaction),
    });
  }

  async deleteDocument(id: string, transaction?: TransactionContext): Promise<void> {
    await this.plugin.db.sequelize.query(`delete from ${DOCUMENTS_COLLECTION} where id = :id`, {
      replacements: { id },
      transaction: this.asTransaction(transaction),
    });
  }

  async deleteDocumentsByShipmentId(shipmentId: string, transaction?: TransactionContext): Promise<void> {
    await this.plugin.db.sequelize.query(`delete from ${DOCUMENTS_COLLECTION} where shipment_id = :shipmentId`, {
      replacements: { shipmentId },
      transaction: this.asTransaction(transaction),
    });
  }

  async deleteFoldersByShipmentId(shipmentId: string, transaction?: TransactionContext): Promise<void> {
    await this.plugin.db.sequelize.query(`delete from ${FOLDERS_COLLECTION} where shipment_id = :shipmentId`, {
      replacements: { shipmentId },
      transaction: this.asTransaction(transaction),
    });
  }

  async attachDraftToShipment(draftToken: string, shipmentId: string, transaction?: TransactionContext): Promise<void> {
    const queryOptions = {
      replacements: { shipmentId, draftToken },
      transaction: this.asTransaction(transaction),
    };
    await this.plugin.db.sequelize.query(
      `
        update ${FOLDERS_COLLECTION}
        set shipment_id = :shipmentId, draft_token = null, "updatedAt" = now()
        where shipment_id is null and draft_token = :draftToken
      `,
      queryOptions,
    );
    await this.plugin.db.sequelize.query(
      `
        update ${DOCUMENTS_COLLECTION}
        set shipment_id = :shipmentId, draft_token = null, "updatedAt" = now()
        where shipment_id is null and draft_token = :draftToken
      `,
      queryOptions,
    );
  }

  private scopePredicate(scope: DocumentScope, alias = ''): string {
    const prefix = alias ? `${alias}.` : '';
    if (scope.mode === 'run') return `${prefix}transport_run_id = :runId`;
    if (scope.mode === 'company') {
      const area = scope.companyArea ? '= :companyArea' : 'is null';
      return `${prefix}company_id = :companyId and ${prefix}transport_run_id is null and ${prefix}company_area ${area}`;
    }
    return scope.mode === 'shipment'
      ? `${prefix}shipment_id = :shipmentId`
      : `${prefix}shipment_id is null and ${prefix}draft_token = :draftToken`;
  }

  private scopeReplacements(scope: DocumentScope): Record<string, string> {
    if (scope.mode === 'run') return { runId: scope.runId };
    if (scope.mode === 'company') {
      return { companyId: scope.companyId, ...(scope.companyArea && { companyArea: scope.companyArea }) };
    }
    return scope.mode === 'shipment' ? { shipmentId: scope.shipmentId } : { draftToken: scope.draftToken };
  }

  private asTransaction(transaction?: TransactionContext): Transaction | undefined {
    return transaction as Transaction | undefined;
  }

  private mapFolder(row: FolderRow): DocumentFolderRecord {
    return {
      id: String(row.id),
      title: row.title,
      shipmentId: row.shipment_id == null ? null : String(row.shipment_id),
      draftToken: row.draft_token || null,
      companyId: row.company_id == null ? null : String(row.company_id),
      ...(row.company_area && { companyArea: row.company_area }),
      runId: row.transport_run_id == null ? null : String(row.transport_run_id),
      grants: row.access_grants ?? null,
      parentFolderId: row.parent_folder_id == null ? null : String(row.parent_folder_id),
      createdById: row.createdById == null ? null : String(row.createdById),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: row.author || '',
    };
  }

  private mapDocument(row: DocumentRow): ProcessDocumentRecord {
    return {
      id: String(row.id),
      title: row.title,
      originalFilename: row.original_filename,
      shipmentId: row.shipment_id == null ? null : String(row.shipment_id),
      draftToken: row.draft_token || null,
      companyId: row.company_id == null ? null : String(row.company_id),
      ...(row.company_area && { companyArea: row.company_area }),
      runId: row.transport_run_id == null ? null : String(row.transport_run_id),
      folderId: row.folder_id == null ? null : String(row.folder_id),
      storageKey: row.storage_key,
      mimeType: row.mime_type || 'application/octet-stream',
      fileSize: Number(row.file_size || 0),
      createdById: row.createdById == null ? null : String(row.createdById),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: row.author || '',
    };
  }
}
