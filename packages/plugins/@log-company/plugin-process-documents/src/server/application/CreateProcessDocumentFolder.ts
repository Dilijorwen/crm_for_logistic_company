import { ProcessDocumentsError } from '../domain/documents/DocumentErrors';
import { DocumentFolderService } from './DocumentFolderService';
import { DocumentScopeService } from './DocumentScopeService';
import type { DocumentActor, ProcessDocumentsRepository } from './ports/ProcessDocumentsRepository';

export interface CreateProcessDocumentFolderInput {
  processId: string | null;
  draftToken: string | null;
  parentFolderId: string | null;
  title: string;
  actor: DocumentActor;
}

export class CreateProcessDocumentFolder {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly scopeService: DocumentScopeService,
    private readonly folderService: DocumentFolderService,
  ) {}

  async execute(input: CreateProcessDocumentFolderInput) {
    const title = input.title.trim();
    if (!title) {
      throw new ProcessDocumentsError('FOLDER_TITLE_REQUIRED', 'Укажите название папки.');
    }
    const scope = await this.scopeService.resolve({ ...input, operation: 'write' });
    return this.repository.withTransaction((transaction) =>
      this.folderService.create(scope, title, input.parentFolderId, input.actor, transaction),
    );
  }
}
