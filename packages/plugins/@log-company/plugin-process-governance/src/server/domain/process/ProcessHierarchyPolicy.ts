import { sameIdentifier, type EntityId } from '../shared/Identifiers';
import { ProcessGovernanceError } from './ProcessGovernanceError';

export function assertParentSelectionDoesNotContainProcess(processId: EntityId, parentIds: EntityId[]): void {
  if (parentIds.some((parentId) => sameIdentifier(parentId, processId))) {
    throw new ProcessGovernanceError('PROCESS_PARENT_SELF', 'Нельзя выбрать текущий процесс как родительский.');
  }
}

export function assertParentSelectionDoesNotCreateCycle(hasCycle: boolean): void {
  if (hasCycle) {
    throw new ProcessGovernanceError(
      'PROCESS_PARENT_CYCLE',
      'Нельзя добавить родительский процесс: связь создаст цикл в истории процессов.',
    );
  }
}
