/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import type { PermitDocumentRepository } from '../ports/PermitDocumentRepository';
import type { PermitRegistryGateway } from '../ports/PermitRegistryGateway';
import type { SyncClock, SyncLogger } from '../ports/PermitDocumentSyncSupport';
import { SynchronizePermitDocument } from '../SynchronizePermitDocument';

function fixture(externalId: string | null = null) {
  const repository = {
    findById: vi.fn().mockResolvedValue({
      id: '10',
      title: 'DOC-1',
      documentType: 'declaration_of_conformity',
      externalId,
      syncStatus: 'PENDING',
      status: null,
      lastCheckedAt: null,
    }),
    findTechnicalRegulationsByFsaIds: vi.fn().mockResolvedValue([]),
    markPending: vi.fn(),
    markNotFound: vi.fn().mockResolvedValue('UPDATED'),
    markError: vi.fn().mockResolvedValue('UPDATED'),
    applySuccess: vi.fn().mockResolvedValue('UPDATED'),
    listPendingIds: vi.fn(),
    listDailyDueIds: vi.fn(),
    clearTechnicalRegulations: vi.fn(),
  } as unknown as PermitDocumentRepository;
  const gateway = {
    findByTitle: vi.fn(),
    getByExternalId: vi.fn(),
    getFsaTechnicalRegulations: vi.fn(),
  } as unknown as PermitRegistryGateway;
  const clock = { now: () => new Date('2026-08-28T00:00:00Z') } as SyncClock;
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as SyncLogger;
  return { repository, gateway, useCase: new SynchronizePermitDocument(repository, gateway, clock, logger) };
}

const card = {
  externalId: '101',
  externalStatus: '6',
  documentName: 'DOC-1',
  documentType: 'declaration_of_conformity' as const,
  validFrom: '2026-08-01',
  validUntil: '2027-08-01',
  status: 'valid' as const,
  productInformation: 'Product',
  technicalRegulations: [{ source: 'FSA' as const, fsaId: 17 }],
};

describe('SynchronizePermitDocument', () => {
  it('searches once, resolves an unknown FSA regulation and applies one atomic result', async () => {
    const { repository, gateway, useCase } = fixture();
    vi.mocked(gateway.findByTitle).mockResolvedValue(card);
    vi.mocked(gateway.getFsaTechnicalRegulations).mockResolvedValue([
      { fsaId: 17, docNum: 'ТР ТС 008/2011', name: 'О безопасности игрушек' },
    ]);

    await expect(useCase.execute('10')).resolves.toBe('SUCCESS');
    expect(gateway.findByTitle).toHaveBeenCalledWith('declaration_of_conformity', 'DOC-1');
    expect(gateway.getByExternalId).not.toHaveBeenCalled();
    expect(repository.applySuccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: '10', title: 'DOC-1' }),
      card,
      [{ fsaId: 17, docNum: 'ТР ТС 008/2011', name: 'О безопасности игрушек' }],
      new Date('2026-08-28T00:00:00Z'),
    );
  });

  it('uses the saved external id for a daily check', async () => {
    const { gateway, useCase } = fixture('101');
    vi.mocked(gateway.getByExternalId).mockResolvedValue({ ...card, technicalRegulations: [] });

    await expect(useCase.execute('10')).resolves.toBe('SUCCESS');
    expect(gateway.getByExternalId).toHaveBeenCalledWith('declaration_of_conformity', '101');
    expect(gateway.findByTitle).not.toHaveBeenCalled();
  });

  it('marks a new document as NOT_FOUND but treats a missing saved card as ERROR', async () => {
    const primary = fixture();
    vi.mocked(primary.gateway.findByTitle).mockResolvedValue(null);
    await expect(primary.useCase.execute('10')).resolves.toBe('NOT_FOUND');
    expect(primary.repository.markNotFound).toHaveBeenCalled();

    const daily = fixture('101');
    vi.mocked(daily.gateway.getByExternalId).mockResolvedValue(null);
    await expect(daily.useCase.execute('10')).resolves.toBe('ERROR');
    expect(daily.repository.markError).toHaveBeenCalledWith(
      expect.objectContaining({ id: '10' }),
      expect.any(Date),
      'REGISTRY_RECORD_MISSING',
    );
  });

  it('stores only a safe error code when a registry response is invalid', async () => {
    const { repository, gateway, useCase } = fixture();
    vi.mocked(gateway.findByTitle).mockResolvedValue({ ...card, status: 'valid', productInformation: '' });

    await expect(useCase.execute('10')).resolves.toBe('ERROR');
    expect(repository.markError).toHaveBeenCalledWith(
      expect.objectContaining({ id: '10' }),
      expect.any(Date),
      'INVALID_REGISTRY_RESPONSE',
    );
  });

  it('shares an active synchronization between repeated requests for the same document', async () => {
    const { gateway, useCase } = fixture();
    let resolveCard: ((value: typeof card) => void) | null = null;
    vi.mocked(gateway.findByTitle).mockReturnValue(
      new Promise((resolve) => {
        resolveCard = resolve;
      }),
    );
    vi.mocked(gateway.getFsaTechnicalRegulations).mockResolvedValue([
      { fsaId: 17, docNum: 'ТР ТС 008/2011', name: 'О безопасности игрушек' },
    ]);

    const first = useCase.execute('10');
    const second = useCase.execute('10');
    resolveCard?.(card);

    await expect(Promise.all([first, second])).resolves.toEqual(['SUCCESS', 'SUCCESS']);
    expect(gateway.findByTitle).toHaveBeenCalledOnce();
  });
});
