import {
  assertDraftOwner,
  assertRecordMatchesScope,
  type DocumentScope,
  type ScopedRecord,
} from '../domain/documents/DocumentScope';
import { ProcessDocumentsError } from '../domain/documents/DocumentErrors';
import type { ProcessDocumentAccess, ProcessDocumentOperation } from './ports/ProcessDocumentAccess';
import type {
  DocumentActor,
  DocumentFolderRecord,
  ProcessDocumentRecord,
  ProcessDocumentsRepository,
  TransactionContext,
} from './ports/ProcessDocumentsRepository';

export interface ResolveDocumentScopeInput {
  processId: string | null;
  draftToken: string | null;
  operation: ProcessDocumentOperation;
  actor: DocumentActor;
}

export class DocumentScopeService {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly access: ProcessDocumentAccess,
  ) {}

  async resolve(input: ResolveDocumentScopeInput): Promise<DocumentScope> {
    if (input.processId) {
      if (!(await this.repository.processExists(input.processId))) {
        throw new ProcessDocumentsError('PROCESS_NOT_FOUND', 'Таможенный процесс не найден.');
      }
      await this.access.assertAccess(input.processId, input.operation, input.actor);
      return { mode: 'process', processId: input.processId };
    }

    if (!input.draftToken) {
      throw new ProcessDocumentsError(
        'PROCESS_REQUIRED',
        'Сначала сохраните таможенный процесс или откройте форму создания процесса.',
      );
    }
    if (
      !input.actor.isRoot &&
      (!input.actor.userId || (await this.repository.draftHasRecordsOwnedByOther(input.draftToken, input.actor.userId)))
    ) {
      throw new ProcessDocumentsError('DRAFT_ACCESS_DENIED', 'Нет прав для действия с черновыми документами процесса.');
    }
    return { mode: 'draft', draftToken: input.draftToken };
  }

  async resolveForDocument(
    document: ProcessDocumentRecord,
    draftToken: string | null,
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
  ): Promise<DocumentScope> {
    return this.resolveForExistingRecord(document, draftToken, operation, actor);
  }

  async resolveForFolder(
    folder: DocumentFolderRecord,
    draftToken: string | null,
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
  ): Promise<DocumentScope> {
    return this.resolveForExistingRecord(folder, draftToken, operation, actor);
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
    if (record.processId) {
      if (!(await this.repository.processExists(record.processId))) {
        throw new ProcessDocumentsError('PROCESS_NOT_FOUND', 'Таможенный процесс не найден.');
      }
      await this.access.assertAccess(record.processId, operation, actor);
      return { mode: 'process', processId: record.processId };
    }

    if (!draftToken) {
      throw new ProcessDocumentsError('DRAFT_ACCESS_DENIED', 'Нет прав для действия с черновыми документами процесса.');
    }
    const scope: DocumentScope = { mode: 'draft', draftToken };
    assertDraftOwner(record, scope, actor);
    return scope;
  }
}
