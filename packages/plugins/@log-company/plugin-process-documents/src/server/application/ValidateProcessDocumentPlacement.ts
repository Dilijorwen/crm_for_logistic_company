import type { DocumentScope } from '../domain/documents/DocumentScope';
import { DocumentScopeService } from './DocumentScopeService';
import type { TransactionContext } from './ports/ProcessDocumentsRepository';

export interface ValidateProcessDocumentPlacementInput {
  folderId: string | null;
  scope: DocumentScope;
  transaction?: TransactionContext;
}

export class ValidateProcessDocumentPlacement {
  constructor(private readonly scopeService: DocumentScopeService) {}

  async execute(input: ValidateProcessDocumentPlacementInput): Promise<void> {
    await this.scopeService.requireFolder(input.folderId, input.scope, input.transaction);
  }
}
