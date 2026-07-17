import { DocumentScopeService } from './DocumentScopeService';
import type { DocumentActor, ProcessDocumentsRepository } from './ports/ProcessDocumentsRepository';

export interface GetProcessDocumentFolderDeleteSummaryInput {
  folderId: string;
  draftToken: string | null;
  actor: DocumentActor;
}

export class GetProcessDocumentFolderDeleteSummary {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly scopeService: DocumentScopeService,
  ) {}

  async execute(input: GetProcessDocumentFolderDeleteSummaryInput) {
    const folder = await this.scopeService.requireFolderById(input.folderId);
    const scope = await this.scopeService.resolveForFolder(folder, input.draftToken, 'delete', input.actor);
    const descendants = await this.scopeService.collectDescendants(folder.id, scope);
    const documents = await this.repository.listDocumentsInFolders(scope, [
      folder.id,
      ...descendants.map((item) => item.id),
    ]);
    return {
      title: folder.title,
      folders: descendants.length,
      files: documents.length,
    };
  }
}
