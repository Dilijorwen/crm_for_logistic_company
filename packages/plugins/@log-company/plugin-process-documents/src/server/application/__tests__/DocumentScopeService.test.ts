/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { ProcessDocumentsError } from '../../domain/documents/DocumentErrors';
import { DocumentScopeService } from '../DocumentScopeService';
import type { ProcessDocumentAccess } from '../ports/ProcessDocumentAccess';
import type { DocumentActor, ProcessDocumentsRepository } from '../ports/ProcessDocumentsRepository';

const actor: DocumentActor = { userId: 'user-1', isRoot: false, authorizationContext: {} };

function fixture(exists: boolean) {
  const shipmentExists = vi.fn(async () => exists);
  const assertAccess = vi.fn(async () => undefined);
  const repository = { shipmentExists } as unknown as ProcessDocumentsRepository;
  const access = { assertAccess } as unknown as ProcessDocumentAccess;
  return { service: new DocumentScopeService(repository, access), shipmentExists, assertAccess };
}

describe('DocumentScopeService', () => {
  it('resolves an existing shipment after checking object-level access', async () => {
    const { service, assertAccess } = fixture(true);

    await expect(
      service.resolve({ shipmentId: 'shipment-1', draftToken: null, operation: 'read', actor }),
    ).resolves.toEqual({ mode: 'shipment', shipmentId: 'shipment-1' });
    expect(assertAccess).toHaveBeenCalledWith('shipment-1', 'read', actor);
  });

  it('rejects an unknown shipment before checking access', async () => {
    const { service, assertAccess } = fixture(false);

    await expect(
      service.resolve({ shipmentId: 'missing', draftToken: null, operation: 'read', actor }),
    ).rejects.toMatchObject({ code: 'SHIPMENT_NOT_FOUND' });
    expect(assertAccess).not.toHaveBeenCalled();
  });

  it('propagates an object-level access denial', async () => {
    const { service, assertAccess } = fixture(true);
    vi.mocked(assertAccess).mockRejectedValue(
      new ProcessDocumentsError('SHIPMENT_ACCESS_DENIED', 'Нет прав на документы поставки.'),
    );

    await expect(
      service.resolve({ shipmentId: 'shipment-1', draftToken: null, operation: 'write', actor }),
    ).rejects.toMatchObject({ code: 'SHIPMENT_ACCESS_DENIED' });
  });
});
