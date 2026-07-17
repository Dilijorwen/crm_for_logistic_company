import { DocumentScopeService } from './DocumentScopeService';
import type { DocumentStorage } from './ports/DocumentStorage';
import type { DocumentActor } from './ports/ProcessDocumentsRepository';

export interface DownloadProcessDocumentInput {
  documentId: string;
  draftToken: string | null;
  actor: DocumentActor;
}

export class DownloadProcessDocument {
  constructor(
    private readonly scopeService: DocumentScopeService,
    private readonly storage: DocumentStorage,
  ) {}

  async execute(input: DownloadProcessDocumentInput) {
    const document = await this.scopeService.requireDocument(input.documentId);
    await this.scopeService.resolveForDocument(document, input.draftToken, 'read', input.actor);
    return {
      content: await this.storage.open(document.storageKey),
      filename: document.title,
      mimeType: document.mimeType || 'application/octet-stream',
      size: document.fileSize,
    };
  }
}
