import { createUniqueDocumentName } from '../domain/documents/DocumentName';
import type { DocumentScope } from '../domain/documents/DocumentScope';
import type { IdentifierGenerator } from './ports/DocumentStorage';
import type {
  DocumentActor,
  DocumentFolderRecord,
  ProcessDocumentsRepository,
  TransactionContext,
} from './ports/ProcessDocumentsRepository';
import { DocumentScopeService } from './DocumentScopeService';

export class DocumentFolderService {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly scopeService: DocumentScopeService,
    private readonly identifierGenerator: IdentifierGenerator,
  ) {}

  async create(
    scope: DocumentScope,
    title: string,
    parentFolderId: string | null,
    actor: DocumentActor,
    transaction?: TransactionContext,
  ): Promise<DocumentFolderRecord> {
    await this.scopeService.requireFolder(parentFolderId, scope, transaction);
    const existingTitles = await this.repository.listFolderTitles(scope, parentFolderId, transaction);
    const uniqueTitle = createUniqueDocumentName(title, existingTitles, false);
    return this.repository.createFolder(
      {
        id: this.identifierGenerator.generate(),
        title: uniqueTitle,
        scope,
        parentFolderId,
        actorId: actor.userId,
      },
      transaction,
    );
  }

  async createPath(
    scope: DocumentScope,
    parentFolderId: string | null,
    folderNames: string[],
    actor: DocumentActor,
    cache: Map<string, string>,
    transaction?: TransactionContext,
  ): Promise<{ folderId: string | null; created: DocumentFolderRecord[] }> {
    let currentParentId = parentFolderId;
    const created: DocumentFolderRecord[] = [];
    for (const folderName of folderNames) {
      const cacheKey = `${currentParentId || 'root'}\n${folderName}`;
      const cachedFolderId = cache.get(cacheKey);
      if (cachedFolderId) {
        currentParentId = cachedFolderId;
        continue;
      }

      const folder = await this.create(scope, folderName, currentParentId, actor, transaction);
      created.push(folder);
      currentParentId = folder.id;
      cache.set(cacheKey, currentParentId);
    }
    return { folderId: currentParentId, created };
  }
}
