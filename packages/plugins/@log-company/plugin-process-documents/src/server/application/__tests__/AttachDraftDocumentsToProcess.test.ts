import { describe, expect, it, vi } from 'vitest';
import { AttachDraftDocumentsToProcess } from '../AttachDraftDocumentsToProcess';
import type { ProcessDocumentsRepository } from '../ports/ProcessDocumentsRepository';

function repositoryStub(options: { hasForeignOwner: boolean }) {
  const draftHasRecordsOwnedByOther = vi.fn().mockResolvedValue(options.hasForeignOwner);
  const attachDraftToProcess = vi.fn().mockResolvedValue(undefined);
  return {
    repository: {
      draftHasRecordsOwnedByOther,
      attachDraftToProcess,
    } as unknown as ProcessDocumentsRepository,
    draftHasRecordsOwnedByOther,
    attachDraftToProcess,
  };
}

describe('AttachDraftDocumentsToProcess', () => {
  it('attaches a draft owned by the process creator', async () => {
    const { repository, attachDraftToProcess } = repositoryStub({ hasForeignOwner: false });
    const useCase = new AttachDraftDocumentsToProcess(repository);
    const transaction = {};

    await useCase.execute({
      draftToken: 'draft-token-123456',
      processId: 'process-1',
      actorId: 'user-1',
      isRoot: false,
      transaction,
    });

    expect(attachDraftToProcess).toHaveBeenCalledWith('draft-token-123456', 'process-1', transaction);
  });

  it('rejects a draft containing records owned by another user', async () => {
    const { repository, attachDraftToProcess } = repositoryStub({ hasForeignOwner: true });
    const useCase = new AttachDraftDocumentsToProcess(repository);

    await expect(
      useCase.execute({
        draftToken: 'draft-token-123456',
        processId: 'process-1',
        actorId: 'user-1',
        isRoot: false,
      }),
    ).rejects.toMatchObject({ code: 'DRAFT_ACCESS_DENIED' });
    expect(attachDraftToProcess).not.toHaveBeenCalled();
  });
});
