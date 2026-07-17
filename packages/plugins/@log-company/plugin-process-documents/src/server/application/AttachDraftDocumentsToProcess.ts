import { ProcessDocumentsError } from '../domain/documents/DocumentErrors';
import type { ProcessDocumentsRepository, TransactionContext } from './ports/ProcessDocumentsRepository';

export interface AttachDraftDocumentsToProcessInput {
  draftToken: string | null;
  processId: string | null;
  actorId: string | null;
  isRoot: boolean;
  transaction?: TransactionContext;
}

export class AttachDraftDocumentsToProcess {
  constructor(private readonly repository: ProcessDocumentsRepository) {}

  async execute(input: AttachDraftDocumentsToProcessInput): Promise<void> {
    if (!input.draftToken || !input.processId) {
      return;
    }
    if (
      !input.isRoot &&
      (!input.actorId || (await this.repository.draftHasRecordsOwnedByOther(input.draftToken, input.actorId)))
    ) {
      throw new ProcessDocumentsError('DRAFT_ACCESS_DENIED', 'Нет прав для переноса черновых документов в процесс.');
    }
    await this.repository.attachDraftToProcess(input.draftToken, input.processId, input.transaction);
  }
}
