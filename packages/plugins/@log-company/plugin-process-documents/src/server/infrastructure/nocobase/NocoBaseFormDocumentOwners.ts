/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { extname } from 'node:path';
import type { BelongsToManyRepository, Model, Transaction } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import type PluginFileManager from '@nocobase/plugin-file-manager/server';
import { generateFileKey, type default as PluginFileStorage } from '@log-company/plugin-file-storage';
import { documentRecordId, PERMIT_DOCUMENT_FOLDERS_META } from '../../../contracts/processDocuments';
import type {
  FormDocumentOwners,
  FormDocumentsPublication,
  FormDocumentsTransaction,
} from '../../application/PublishFormDocuments';
import type { TransactionContext } from '../../application/ports/ProcessDocumentsRepository';
import { ProcessDocumentsError } from '../../domain/documents/DocumentErrors';
import { splitRelativeDocumentName } from '../../domain/documents/DocumentName';
import type { NocoBaseProcessDocumentAccess } from './NocoBaseProcessDocumentAccess';

export class NocoBaseFormDocumentOwners implements FormDocumentOwners {
  constructor(
    private readonly plugin: Plugin,
    private readonly fileManager: PluginFileManager,
    private readonly files: PluginFileStorage,
    private readonly access: NocoBaseProcessDocumentAccess,
  ) {}

  async contractImporterIds(id: string, transaction: TransactionContext): Promise<string[]> {
    const relation = this.plugin.db.getRepository<BelongsToManyRepository>('contracts.importers', id);
    const companies: Model[] = await relation.find({
      fields: ['id'],
      limit: 2,
      transaction: transaction as Transaction,
    });
    return companies.map((company) => {
      const companyId = documentRecordId(company.get('id'));
      if (!companyId)
        throw new ProcessDocumentsError('INVALID_DOCUMENT_SCOPE', 'Не удалось определить компанию контракта.');
      return companyId;
    });
  }

  async lockCompany(id: string, outer: TransactionContext): Promise<void> {
    const transaction = outer as Transaction;
    const company = await this.plugin.db.getCollection('our_companies').model.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!company) throw new ProcessDocumentsError('OWNER_NOT_FOUND', 'Компания не найдена.');
  }

  async publishPermit(input: FormDocumentsPublication, outer: FormDocumentsTransaction): Promise<void> {
    await this.access.assertPermitUpload(input.recordId, input.actor, outer.transaction);
    await this.publishAttachment('permit_documents.documents', input, outer);
  }

  async publishContract(input: FormDocumentsPublication, outer: FormDocumentsTransaction): Promise<void> {
    await this.access.assertContractUpload(input.recordId, input.actor, outer.transaction);
    await this.publishAttachment('contracts.documents', input, outer);
  }

  private async publishAttachment(
    relationName: 'permit_documents.documents' | 'contracts.documents',
    { recordId, actor, files }: FormDocumentsPublication,
    outer: FormDocumentsTransaction,
  ): Promise<void> {
    const transaction = outer.transaction as Transaction;
    const storage = [...this.fileManager.storagesCache.values()].find(
      ({ name, type }) => name === 'log-company-files' && type === 'log-company-private-minio',
    );
    if (storage?.id == null) {
      throw new ProcessDocumentsError('STORAGE_UPLOAD_FAILED', 'Хранилище вложений недоступно.');
    }
    const path = (storage.path || '').replace(/^\/|\/$/g, '');
    const storedKeys: string[] = [];
    outer.onRollback(async () => {
      if (!storedKeys.length) return;
      try {
        await this.files.deletionQueue.enqueue('attachments', storedKeys, { currentOnly: true });
      } catch {
        const removed = await Promise.allSettled(
          storedKeys.map((key) => this.files.storage.area('attachments').delete(key, true)),
        );
        if (removed.some(({ status }) => status === 'rejected')) {
          this.plugin.log.error('Не удалось очистить вложения после отмены сохранения.');
        }
      }
    });
    const attachmentIds: string[] = [];
    for (const file of files) {
      const { folders, filename: original } = splitRelativeDocumentName(file.originalName);
      const filename = generateFileKey('', original);
      const key = [path, filename].filter(Boolean).join('/');
      try {
        await this.files.storage
          .area('attachments')
          .store({ key, filePath: file.path, size: file.size, contentType: file.mimeType });
      } catch {
        throw new ProcessDocumentsError('STORAGE_UPLOAD_FAILED', 'Не удалось загрузить файл в хранилище документов.');
      }
      storedKeys.push(key);
      const extension = extname(original);
      const attachment = await this.plugin.db.getRepository('attachments').create({
        values: {
          filename,
          path,
          title: extension ? original.slice(0, -extension.length) : original,
          extname: extension,
          mimetype: file.mimeType,
          storageId: storage.id,
          size: file.size,
          createdById: actor.userId,
          ...(folders.length && { meta: { [PERMIT_DOCUMENT_FOLDERS_META]: folders } }),
        },
        transaction,
      });
      attachmentIds.push(String(attachment.get('id')));
    }
    const relation = this.plugin.db.getRepository<BelongsToManyRepository>(relationName, recordId);
    await relation.add({ tk: attachmentIds, transaction });
  }
}
