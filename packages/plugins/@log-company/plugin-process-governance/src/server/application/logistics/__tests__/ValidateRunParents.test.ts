/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import type { LogisticsRepository } from '../ports/LogisticsRepository';
import { ValidateRunParents } from '../ValidateRunParents';

function setup(hasCycle: boolean) {
  const repository = {
    lockRunParentGraph: vi.fn(async () => undefined),
    runParentSelectionCreatesCycle: vi.fn(async () => hasCycle),
  } as unknown as LogisticsRepository;
  return { repository, action: new ValidateRunParents(repository) };
}

describe('ValidateRunParents', () => {
  it('allows an acyclic parent selection', async () => {
    const { repository, action } = setup(false);
    await expect(action.execute({ runId: '10', parentIds: ['2', '2', '3'] })).resolves.toBeUndefined();
    expect(repository.lockRunParentGraph).toHaveBeenCalledOnce();
    expect(repository.runParentSelectionCreatesCycle).toHaveBeenCalledWith('10', ['2', '3'], undefined);
  });

  it('rejects a self link before querying the graph', async () => {
    const { repository, action } = setup(false);
    await expect(action.execute({ runId: '10', parentIds: ['10'] })).rejects.toMatchObject({
      code: 'RUN_PARENT_SELF',
    });
    expect(repository.runParentSelectionCreatesCycle).not.toHaveBeenCalled();
  });

  it('rejects a link to a descendant', async () => {
    const { action } = setup(true);
    await expect(action.execute({ runId: '10', parentIds: ['12'] })).rejects.toMatchObject({
      code: 'RUN_PARENT_CYCLE',
    });
  });
});
