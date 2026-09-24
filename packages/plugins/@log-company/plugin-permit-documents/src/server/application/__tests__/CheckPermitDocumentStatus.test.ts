/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { CheckPermitDocumentStatus } from '../CheckPermitDocumentStatus';
import type { PermitDocumentRepository } from '../ports/PermitDocumentRepository';
import type { PermitRegistryGateway } from '../ports/PermitRegistryGateway';
import type { SyncClock, SyncLogger } from '../ports/PermitDocumentSyncSupport';

function fixture() {
  const repository = {
    findById: vi.fn().mockResolvedValue({
      id: '10',
      title: 'DOC-1',
      documentType: 'declaration_of_conformity',
      externalId: '101',
      syncStatus: 'SUCCESS',
      status: 'valid',
      lastCheckedAt: new Date('2026-08-27T00:00:00Z'),
    }),
    applyStatusCheck: vi.fn().mockResolvedValue('UPDATED'),
    markError: vi.fn().mockResolvedValue('UPDATED'),
  } as unknown as PermitDocumentRepository;
  const registry = {
    findStatusByTitle: vi.fn(),
  } as unknown as PermitRegistryGateway;
  const clock = { now: () => new Date('2026-08-28T00:00:00Z') } as SyncClock;
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as SyncLogger;
  return { repository, registry, useCase: new CheckPermitDocumentStatus(repository, registry, clock, logger) };
}

const status = {
  externalId: '101',
  externalStatus: '15',
  documentName: 'DOC-1',
  documentType: 'declaration_of_conformity' as const,
  status: 'suspended' as const,
};

describe('CheckPermitDocumentStatus', () => {
  it('uses the lightweight registry search and applies only the status result', async () => {
    const { repository, registry, useCase } = fixture();
    vi.mocked(registry.findStatusByTitle).mockResolvedValue(status);

    await expect(useCase.execute('10')).resolves.toBe('SUCCESS');
    expect(registry.findStatusByTitle).toHaveBeenCalledWith('declaration_of_conformity', 'DOC-1');
    expect(repository.applyStatusCheck).toHaveBeenCalledWith(
      expect.objectContaining({ id: '10', title: 'DOC-1' }),
      '101',
      status,
      new Date('2026-08-28T00:00:00Z'),
    );
  });

  it('stores an error when the saved registry record is no longer returned', async () => {
    const { repository, registry, useCase } = fixture();
    vi.mocked(registry.findStatusByTitle).mockResolvedValue(null);

    await expect(useCase.execute('10')).resolves.toBe('ERROR');
    expect(repository.markError).toHaveBeenCalledWith(
      expect.objectContaining({ id: '10' }),
      new Date('2026-08-28T00:00:00Z'),
      'REGISTRY_RECORD_MISSING',
    );
  });

  it('rejects a search result that belongs to another registry card', async () => {
    const { repository, registry, useCase } = fixture();
    vi.mocked(registry.findStatusByTitle).mockResolvedValue({ ...status, externalId: '202' });

    await expect(useCase.execute('10')).resolves.toBe('ERROR');
    expect(repository.applyStatusCheck).not.toHaveBeenCalled();
    expect(repository.markError).toHaveBeenCalledWith(
      expect.objectContaining({ id: '10' }),
      expect.any(Date),
      'INVALID_REGISTRY_RESPONSE',
    );
  });
});
