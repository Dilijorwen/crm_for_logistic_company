/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { assertDraftOwner, assertRecordMatchesScope } from '../domain/documents/DocumentScope';
import { companyRequestFolderTypes, isCompanyRequestFolder } from '../../contracts/processDocuments';
import type { CompanyDocumentTarget, DocumentScope, ScopedRecord } from '../domain/documents/DocumentScope';
import { allowsFolderOperation } from '../domain/documents/FolderAccess';
import { ProcessDocumentsError } from '../domain/documents/DocumentErrors';
import type { ProcessDocumentAccess, ProcessDocumentOperation } from './ports/ProcessDocumentAccess';
import type {
  DocumentActor,
  DocumentFolderRecord,
  ProcessDocumentRecord,
  ProcessDocumentsRepository,
  TransactionContext,
} from './ports/ProcessDocumentsRepository';

export interface ResolveDocumentScopeInput extends CompanyDocumentTarget {
  shipmentId: string | null;
  draftToken: string | null;
  operation: ProcessDocumentOperation;
  actor: DocumentActor;
}

export class DocumentScopeService {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly access: ProcessDocumentAccess,
  ) {}

  async resolve(input: ResolveDocumentScopeInput, transaction?: TransactionContext): Promise<DocumentScope> {
    if (input.companyId || input.runId) {
      if (input.shipmentId || input.draftToken) {
        throw new ProcessDocumentsError('INVALID_DOCUMENT_SCOPE', 'Укажите один раздел для документов.');
      }
      if (input.runId && this.access.assertRunAccess) {
        if (transaction)
          await this.access.assertRunAccess(
            input.runId,
            input.operation,
            input.actor,
            input.companyId ?? null,
            transaction,
          );
        else await this.access.assertRunAccess(input.runId, input.operation, input.actor, input.companyId ?? null);
        return { mode: 'run', runId: input.runId };
      }
      if (!input.runId && input.companyId && this.access.assertCompanyAccess) {
        const scope = {
          mode: 'company' as const,
          companyId: input.companyId,
          ...(input.companyArea ? { companyArea: input.companyArea } : {}),
        };
        if (transaction) await this.access.assertCompanyAccess(scope, input.operation, input.actor, transaction);
        else await this.access.assertCompanyAccess(scope, input.operation, input.actor);
        return scope;
      }
      throw new ProcessDocumentsError('INVALID_DOCUMENT_SCOPE', 'Раздел документов недоступен.');
    }
    if (input.shipmentId) {
      if (
        !(await (transaction
          ? this.repository.shipmentExists(input.shipmentId, transaction)
          : this.repository.shipmentExists(input.shipmentId)))
      ) {
        throw new ProcessDocumentsError('SHIPMENT_NOT_FOUND', 'Поставка не найдена.');
      }
      if (transaction) await this.access.assertAccess(input.shipmentId, input.operation, input.actor, transaction);
      else await this.access.assertAccess(input.shipmentId, input.operation, input.actor);
      return { mode: 'shipment', shipmentId: input.shipmentId };
    }

    if (!input.draftToken) {
      throw new ProcessDocumentsError(
        'SHIPMENT_REQUIRED',
        'Сначала сохраните поставку или откройте форму создания поставки.',
      );
    }
    await this.access.assertDraftAccess?.(input.operation, input.actor);
    if (
      !input.actor.isRoot &&
      (!input.actor.userId || (await this.repository.draftHasRecordsOwnedByOther(input.draftToken, input.actor.userId)))
    ) {
      throw new ProcessDocumentsError('DRAFT_ACCESS_DENIED', 'Нет прав для действия с черновыми документами поставки.');
    }
    return { mode: 'draft', draftToken: input.draftToken };
  }

  async resolveForDocument(
    document: ProcessDocumentRecord,
    draftToken: string | null,
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
  ): Promise<DocumentScope> {
    const scope = await this.resolveForExistingRecord(document, draftToken, operation, actor);
    await this.assertFolderAccess(document.folderId, scope, operation, actor);
    return scope;
  }

  async resolveForFolder(
    folder: DocumentFolderRecord,
    draftToken: string | null,
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
  ): Promise<DocumentScope> {
    const scope = await this.resolveForExistingRecord(folder, draftToken, operation, actor);
    await this.assertFolderAccess(folder.id, scope, operation, actor);
    return scope;
  }

  async assertFolderAccess(
    folderId: string | null,
    scope: DocumentScope,
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
    transaction?: TransactionContext,
  ): Promise<void> {
    if (actor.isRoot) return;
    const seen = new Set<string>();
    let current = folderId;
    let childTitle: string | undefined;
    while (current) {
      if (seen.has(current)) throw new ProcessDocumentsError('FOLDER_CYCLE', 'Обнаружен цикл папок.');
      seen.add(current);
      const folder = await this.requireFolder(current, scope, transaction);
      if (!folder) return;
      if (!allowsFolderOperation(folder.grants, operation, actor)) {
        throw new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'Нет доступа к папке.');
      }
      if (folder.parentFolderId === null && isCompanyRequestFolder(folder.title)) {
        await this.assertCompanyFolderSection(scope, 'requests', operation, actor);
        if (childTitle === companyRequestFolderTypes.our_companies) {
          await this.assertCompanyFolderSection(scope, 'corporate', operation, actor);
        }
      }
      childTitle = folder.title;
      current = folder.parentFolderId;
    }
  }

  async allowsCompanyFolderSection(
    scope: DocumentScope,
    section: 'requests' | 'corporate',
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
  ): Promise<boolean> {
    if (actor.isRoot || scope.mode !== 'company' || scope.companyArea !== 'company') return true;
    return (await this.access.allowsCompanyFolderSection?.(section, scope.companyId, operation, actor)) ?? true;
  }

  async assertCompanyFolderSection(
    scope: DocumentScope,
    section: 'requests' | 'corporate',
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
  ): Promise<void> {
    if (!(await this.allowsCompanyFolderSection(scope, section, operation, actor))) {
      throw new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'Нет доступа к папке.');
    }
  }

  async requireFolder(
    folderId: string | null,
    scope: DocumentScope,
    transaction?: TransactionContext,
  ): Promise<DocumentFolderRecord | null> {
    if (!folderId) {
      return null;
    }

    const folder = await this.repository.findFolderById(folderId, transaction);
    if (!folder) {
      throw new ProcessDocumentsError('FOLDER_NOT_FOUND', 'Папка документов не найдена.');
    }
    assertRecordMatchesScope(folder, scope);
    return folder;
  }

  async requireDocument(documentId: string, transaction?: TransactionContext): Promise<ProcessDocumentRecord> {
    const document = await this.repository.findDocumentById(documentId, transaction);
    if (!document) {
      throw new ProcessDocumentsError('DOCUMENT_NOT_FOUND', 'Документ не найден.');
    }
    return document;
  }

  async requireFolderById(folderId: string, transaction?: TransactionContext): Promise<DocumentFolderRecord> {
    const folder = await this.repository.findFolderById(folderId, transaction);
    if (!folder) {
      throw new ProcessDocumentsError('FOLDER_NOT_FOUND', 'Папка документов не найдена.');
    }
    return folder;
  }

  async collectDescendants(
    folderId: string,
    scope: DocumentScope,
    transaction?: TransactionContext,
  ): Promise<DocumentFolderRecord[]> {
    const folders: DocumentFolderRecord[] = [];
    const stack = [folderId];
    const visited = new Set(stack);
    while (stack.length) {
      const currentFolderId = stack.pop() as string;
      const children = await this.repository.listChildFolders(scope, currentFolderId, transaction);
      for (const child of children) {
        if (visited.has(child.id)) {
          continue;
        }
        visited.add(child.id);
        folders.push(child);
        stack.push(child.id);
      }
    }
    return folders;
  }

  async getBreadcrumbs(folderId: string | null, scope: DocumentScope): Promise<Array<{ id: string; title: string }>> {
    const breadcrumbs: Array<{ id: string; title: string }> = [];
    const seen = new Set<string>();
    let currentId = folderId;
    while (currentId) {
      if (seen.has(currentId)) {
        throw new ProcessDocumentsError('FOLDER_CYCLE', 'Нельзя создать цикл в структуре папок.');
      }
      seen.add(currentId);
      const folder = await this.requireFolder(currentId, scope);
      if (!folder) {
        break;
      }
      breadcrumbs.unshift({ id: folder.id, title: folder.title });
      currentId = folder.parentFolderId;
    }
    return breadcrumbs;
  }

  private async resolveForExistingRecord(
    record: ScopedRecord & { createdById: string | null },
    draftToken: string | null,
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
  ): Promise<DocumentScope> {
    if (record.companyId || record.runId) {
      return this.resolve({
        shipmentId: null,
        draftToken: null,
        companyId: record.companyId,
        companyArea: record.companyArea,
        runId: record.runId,
        operation,
        actor,
      });
    }
    if (record.shipmentId) {
      if (!(await this.repository.shipmentExists(record.shipmentId))) {
        throw new ProcessDocumentsError('SHIPMENT_NOT_FOUND', 'Поставка не найдена.');
      }
      await this.access.assertAccess(record.shipmentId, operation, actor);
      return { mode: 'shipment', shipmentId: record.shipmentId };
    }

    if (!draftToken) {
      throw new ProcessDocumentsError('DRAFT_ACCESS_DENIED', 'Нет прав для действия с черновыми документами поставки.');
    }
    await this.access.assertDraftAccess?.(operation, actor);
    const scope: DocumentScope = { mode: 'draft', draftToken };
    assertDraftOwner(record, scope, actor);
    return scope;
  }
}
