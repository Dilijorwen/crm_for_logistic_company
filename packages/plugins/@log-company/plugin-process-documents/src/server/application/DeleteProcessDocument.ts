import { DocumentScopeService } from './DocumentScopeService';
import type { ApplicationLogger, DocumentStorage } from './ports/DocumentStorage';
import type { DocumentActor, ProcessDocumentsRepository } from './ports/ProcessDocumentsRepository';

export interface DeleteProcessDocumentInput {
  documentId: string;
  draftToken: string | null;
  actor: DocumentActor;
}

export class DeleteProcessDocument {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly scopeService: DocumentScopeService,
    private readonly storage: DocumentStorage,
    private readonly logger: ApplicationLogger,
  ) {}

  async execute(input: DeleteProcessDocumentInput): Promise<void> {
    const document = await this.scopeService.requireDocument(input.documentId);
    await this.scopeService.resolveForDocument(document, input.draftToken, 'delete', input.actor);
    await this.repository.withTransaction((transaction) => this.repository.deleteDocument(document.id, transaction));
    try {
      const deleted = await this.storage.delete(document.storageKey);
      if (!deleted) {
        this.logger.warn('Объект удалённого документа уже отсутствовал в хранилище', {
          storageKey: document.storageKey,
        });
      }
    } catch (error) {
      this.logger.error('После удаления документа остался объект в хранилище', error, {
        documentId: document.id,
        storageKey: document.storageKey,
      });
    }
  }
}
