import { calculateFolderDepth } from '../domain/documents/FolderHierarchy';
import { DocumentScopeService } from './DocumentScopeService';
import type { ApplicationLogger, DocumentStorage } from './ports/DocumentStorage';
import type { DocumentActor, ProcessDocumentsRepository } from './ports/ProcessDocumentsRepository';

export interface DeleteProcessDocumentFolderInput {
  folderId: string;
  draftToken: string | null;
  actor: DocumentActor;
}

export class DeleteProcessDocumentFolder {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly scopeService: DocumentScopeService,
    private readonly storage: DocumentStorage,
    private readonly logger: ApplicationLogger,
  ) {}

  async execute(input: DeleteProcessDocumentFolderInput): Promise<void> {
    const folder = await this.scopeService.requireFolderById(input.folderId);
    const scope = await this.scopeService.resolveForFolder(folder, input.draftToken, 'delete', input.actor);
    const documents = await this.repository.withTransaction(async (transaction) => {
      const descendants = await this.scopeService.collectDescendants(folder.id, scope, transaction);
      const affectedFolders = [folder, ...descendants];
      const orderedFolders = affectedFolders.sort(
        (left, right) => calculateFolderDepth(right, affectedFolders) - calculateFolderDepth(left, affectedFolders),
      );
      const affectedDocuments = await this.repository.listDocumentsInFolders(
        scope,
        orderedFolders.map((item) => item.id),
        transaction,
      );
      for (const document of affectedDocuments) {
        await this.repository.deleteDocument(document.id, transaction);
      }
      for (const currentFolder of orderedFolders) {
        await this.repository.deleteFolder(currentFolder.id, transaction);
      }
      return affectedDocuments;
    });

    await Promise.all(
      documents.map(async (document) => {
        try {
          const deleted = await this.storage.delete(document.storageKey);
          if (!deleted) {
            this.logger.warn('Объект документа из удалённой папки уже отсутствовал в хранилище', {
              documentId: document.id,
              storageKey: document.storageKey,
            });
          }
        } catch (error) {
          this.logger.error('После удаления папки остался объект в хранилище', error, {
            documentId: document.id,
            storageKey: document.storageKey,
          });
        }
      }),
    );
  }
}
