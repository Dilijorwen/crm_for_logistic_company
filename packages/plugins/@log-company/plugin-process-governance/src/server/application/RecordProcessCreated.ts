import type { EntityId } from '../domain/shared/Identifiers';
import { GetProcessTitle } from './GetProcessTitle';
import { WriteProcessHistory } from './WriteProcessHistory';
import type { GovernanceTransaction } from './ports/ProcessGovernanceRepository';

export interface RecordProcessCreatedInput {
  processId: EntityId;
  title: string;
  transaction?: GovernanceTransaction;
  context?: unknown;
}

export class RecordProcessCreated {
  constructor(
    private readonly getProcessTitle: GetProcessTitle,
    private readonly writeHistory: WriteProcessHistory,
  ) {}

  async execute(input: RecordProcessCreatedInput): Promise<void> {
    await this.writeHistory.execute({
      entry: {
        processId: String(input.processId),
        eventType: 'created',
        fieldName: null,
        fieldLabel: 'Создан процесс',
        oldValue: null,
        newValue: input.title || (await this.getProcessTitle.execute(input.processId, input.transaction)),
      },
      transaction: input.transaction,
      context: input.context,
    });
  }
}
