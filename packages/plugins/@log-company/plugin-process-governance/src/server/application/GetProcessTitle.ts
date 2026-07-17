import type { EntityId } from '../domain/shared/Identifiers';
import { normalizeText } from '../domain/shared/Identifiers';
import { BuildComputedProcessTitle } from './BuildComputedProcessTitle';
import type { GovernanceTransaction, ProcessGovernanceRepository } from './ports/ProcessGovernanceRepository';

export class GetProcessTitle {
  constructor(
    private readonly repository: ProcessGovernanceRepository,
    private readonly buildComputedTitle: BuildComputedProcessTitle,
  ) {}

  async execute(processId: EntityId, transaction?: GovernanceTransaction): Promise<string> {
    const process = await this.repository.findProcess(processId, transaction);
    if (!process) {
      return String(processId);
    }
    if (normalizeText(process.title)) {
      return normalizeText(process.title);
    }
    return this.buildComputedTitle.execute({
      processId,
      processNumber: process.processNumber,
      carNumber: process.carNumber,
      chineseClientId: process.chineseClientId,
      transaction,
    });
  }
}
