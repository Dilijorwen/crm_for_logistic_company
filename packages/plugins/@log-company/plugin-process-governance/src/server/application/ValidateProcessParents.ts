import {
  assertParentSelectionDoesNotContainProcess,
  assertParentSelectionDoesNotCreateCycle,
} from '../domain/process/ProcessHierarchyPolicy';
import { uniqueIdentifiers, type EntityId } from '../domain/shared/Identifiers';
import type { GovernanceTransaction, ProcessGovernanceRepository } from './ports/ProcessGovernanceRepository';

export interface ValidateProcessParentsInput {
  processId: EntityId | null;
  parentIds: EntityId[];
  transaction?: GovernanceTransaction;
}

export class ValidateProcessParents {
  constructor(private readonly repository: ProcessGovernanceRepository) {}

  async execute(input: ValidateProcessParentsInput): Promise<void> {
    if (input.processId === null) {
      return;
    }
    const parentIds = uniqueIdentifiers(input.parentIds);
    if (!parentIds.length) {
      return;
    }

    assertParentSelectionDoesNotContainProcess(input.processId, parentIds);
    await this.repository.lockParentGraph(input.transaction);
    const hasCycle = await this.repository.parentSelectionCreatesCycle(input.processId, parentIds, input.transaction);
    assertParentSelectionDoesNotCreateCycle(hasCycle);
  }
}
