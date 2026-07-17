import { describe, expect, it, vi } from 'vitest';
import { ValidateProcessParents } from '../ValidateProcessParents';
import type { ProcessGovernanceRepository } from '../ports/ProcessGovernanceRepository';

function repositoryWithCycle(hasCycle: boolean) {
  return {
    lockParentGraph: vi.fn(async () => undefined),
    parentSelectionCreatesCycle: vi.fn(async () => hasCycle),
  } as unknown as ProcessGovernanceRepository;
}

describe('ValidateProcessParents', () => {
  it('accepts a valid parent selection', async () => {
    const repository = repositoryWithCycle(false);
    await expect(
      new ValidateProcessParents(repository).execute({ processId: 1, parentIds: [2, 3] }),
    ).resolves.toBeUndefined();
    expect(repository.parentSelectionCreatesCycle).toHaveBeenCalledOnce();
  });

  it('rejects the process itself', async () => {
    const repository = repositoryWithCycle(false);
    await expect(new ValidateProcessParents(repository).execute({ processId: 1, parentIds: [1] })).rejects.toThrowError(
      'Нельзя выбрать текущий процесс как родительский.',
    );
    expect(repository.parentSelectionCreatesCycle).not.toHaveBeenCalled();
  });

  it('rejects a graph cycle reported by the repository port', async () => {
    const repository = repositoryWithCycle(true);
    await expect(new ValidateProcessParents(repository).execute({ processId: 1, parentIds: [2] })).rejects.toThrowError(
      'Нельзя добавить родительский процесс: связь создаст цикл в истории процессов.',
    );
  });
});
