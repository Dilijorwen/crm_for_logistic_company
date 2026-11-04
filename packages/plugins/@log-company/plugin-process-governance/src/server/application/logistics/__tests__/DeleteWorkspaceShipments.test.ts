/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  DeleteWorkspaceShipments,
  WorkspaceDeletionError,
  type WorkspaceDeletionSession,
} from '../DeleteWorkspaceShipments';

function setup(emptyRuns: string[] = []) {
  const session: WorkspaceDeletionSession = {
    select: vi.fn(async () => ({ shipmentIds: ['100'], runIds: ['10', '11'] })),
    assertShipmentDeletion: vi.fn(async () => undefined),
    assertRunDeletion: vi.fn(async () => undefined),
    findRunsEmptiedBy: vi.fn(async () => emptyRuns),
    detachShipments: vi.fn(async () => undefined),
    destroyShipments: vi.fn(async () => undefined),
    destroyRuns: vi.fn(async () => undefined),
  };
  const run = vi.fn(async <T>(work: (value: WorkspaceDeletionSession) => Promise<T>): Promise<T> => work(session));
  return { useCase: new DeleteWorkspaceShipments({ run }), session, run };
}

describe('DeleteWorkspaceShipments', () => {
  it('deduplicates selected rows and preserves runs which still have shipments', async () => {
    const { useCase, session } = setup();
    expect(await useCase.execute(['10:100', '10:100', '11:100'])).toEqual({
      shipments: 1,
      runs: 0,
      shipmentIds: ['100'],
      runIds: [],
    });
    expect(session.select).toHaveBeenCalledWith(['10:100', '11:100']);
    expect(session.destroyShipments).toHaveBeenCalledWith(['100']);
    expect(session.destroyRuns).not.toHaveBeenCalled();
  });

  it('deletes every affected run which would become empty', async () => {
    const { useCase, session } = setup(['10', '11']);
    expect(await useCase.execute(['10:100'])).toEqual({
      shipments: 1,
      runs: 2,
      shipmentIds: ['100'],
      runIds: ['10', '11'],
    });
    expect(session.assertRunDeletion).toHaveBeenCalledWith('10');
    expect(session.assertRunDeletion).toHaveBeenCalledWith('11');
    expect(session.destroyRuns).toHaveBeenCalledWith(['10', '11']);
  });

  it('checks run permissions before changing any source data', async () => {
    const { useCase, session } = setup(['10']);
    vi.mocked(session.assertRunDeletion).mockRejectedValue(new WorkspaceDeletionError('FORBIDDEN', 'denied'));
    await expect(useCase.execute(['10:100'])).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(session.detachShipments).not.toHaveBeenCalled();
    expect(session.destroyShipments).not.toHaveBeenCalled();
  });

  it('rejects invalid and empty selections without starting a transaction', async () => {
    const { useCase, run } = setup();
    for (const value of [null, [], ['10:0'], ['invalid'], new Array(201).fill('10:100')]) {
      await expect(useCase.execute(value)).rejects.toMatchObject({ code: 'INVALID_SELECTION' });
    }
    expect(run).not.toHaveBeenCalled();
  });

  it('does not mutate data when the selected link no longer exists', async () => {
    const { useCase, session } = setup();
    vi.mocked(session.select).mockRejectedValue(new WorkspaceDeletionError('NOT_FOUND', 'missing'));
    await expect(useCase.execute(['10:100'])).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(session.detachShipments).not.toHaveBeenCalled();
  });

  it('propagates a storage failure to the unit of work for rollback', async () => {
    const { useCase, session } = setup(['10']);
    vi.mocked(session.destroyShipments).mockRejectedValue(new Error('storage unavailable'));
    await expect(useCase.execute(['10:100'])).rejects.toThrow('storage unavailable');
    expect(session.destroyRuns).not.toHaveBeenCalled();
  });
});
