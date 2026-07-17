import type { DocumentActor, ProcessDocumentsRepository } from './ports/ProcessDocumentsRepository';
import { DocumentScopeService } from './DocumentScopeService';

export interface ListProcessDocumentsInput {
  processId: string | null;
  draftToken: string | null;
  folderId: string | null;
  actor: DocumentActor;
}

export class ListProcessDocuments {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly scopeService: DocumentScopeService,
  ) {}

  async execute(input: ListProcessDocumentsInput) {
    const scope = await this.scopeService.resolve({ ...input, operation: 'read' });
    let folderId = input.folderId;
    if (folderId) {
      try {
        await this.scopeService.requireFolder(folderId, scope);
      } catch {
        folderId = null;
      }
    }

    const [folders, files, breadcrumbs] = await Promise.all([
      this.repository.listFolders(scope, folderId),
      this.repository.listDocuments(scope, folderId),
      this.scopeService.getBreadcrumbs(folderId, scope),
    ]);
    return {
      breadcrumbs,
      folders,
      files,
      permissions: { canRead: true, canWrite: true, canDelete: true },
    };
  }
}
