/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { AttachDraftDocumentsToProcess } from '../AttachDraftDocumentsToProcess';
import type { ProcessDocumentsRepository } from '../ports/ProcessDocumentsRepository';

function repositoryStub(options: { hasForeignOwner: boolean }) {
  const draftHasRecordsOwnedByOther = vi.fn().mockResolvedValue(options.hasForeignOwner);
  const attachDraftToShipment = vi.fn().mockResolvedValue(undefined);
  return {
    repository: {
      draftHasRecordsOwnedByOther,
      attachDraftToShipment,
    } as unknown as ProcessDocumentsRepository,
    draftHasRecordsOwnedByOther,
    attachDraftToShipment,
  };
}

describe('AttachDraftDocumentsToProcess', () => {
  it('attaches a draft owned by the shipment creator', async () => {
    const { repository, attachDraftToShipment } = repositoryStub({ hasForeignOwner: false });
    const useCase = new AttachDraftDocumentsToProcess(repository);
    const transaction = {};

    await useCase.execute({
      draftToken: 'draft-token-123456',
      shipmentId: 'shipment-1',
      actorId: 'user-1',
      isRoot: false,
      transaction,
    });

    expect(attachDraftToShipment).toHaveBeenCalledWith('draft-token-123456', 'shipment-1', transaction);
  });

  it('rejects a draft containing records owned by another user', async () => {
    const { repository, attachDraftToShipment } = repositoryStub({ hasForeignOwner: true });
    const useCase = new AttachDraftDocumentsToProcess(repository);

    await expect(
      useCase.execute({
        draftToken: 'draft-token-123456',
        shipmentId: 'shipment-1',
        actorId: 'user-1',
        isRoot: false,
      }),
    ).rejects.toMatchObject({ code: 'DRAFT_ACCESS_DENIED' });
    expect(attachDraftToShipment).not.toHaveBeenCalled();
  });
});
