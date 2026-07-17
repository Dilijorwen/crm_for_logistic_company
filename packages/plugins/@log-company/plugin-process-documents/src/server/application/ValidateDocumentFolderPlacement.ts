import { assertFolderChainHasNoCycle, assertFolderIsNotItsOwnParent } from '../domain/documents/FolderHierarchy';
import type { DocumentScope } from '../domain/documents/DocumentScope';
import { DocumentScopeService } from './DocumentScopeService';
import type { ProcessDocumentsRepository, TransactionContext } from './ports/ProcessDocumentsRepository';

export interface ValidateDocumentFolderPlacementInput {
  folderId: string | null;
  parentFolderId: string | null;
  scope: DocumentScope;
  transaction?: TransactionContext;
}

export class ValidateDocumentFolderPlacement {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly scopeService: DocumentScopeService,
  ) {}

  async execute(input: ValidateDocumentFolderPlacementInput): Promise<void> {
    assertFolderIsNotItsOwnParent(input.folderId, input.parentFolderId);
    if (!input.parentFolderId) {
      return;
    }

    const parentChain = [];
    let currentFolder = await this.scopeService.requireFolder(input.parentFolderId, input.scope, input.transaction);
    while (currentFolder) {
      parentChain.push(currentFolder);
      assertFolderChainHasNoCycle(input.folderId, parentChain);
      if (!currentFolder.parentFolderId) {
        break;
      }
      currentFolder = await this.scopeService.requireFolder(
        currentFolder.parentFolderId,
        input.scope,
        input.transaction,
      );
    }
  }
}
