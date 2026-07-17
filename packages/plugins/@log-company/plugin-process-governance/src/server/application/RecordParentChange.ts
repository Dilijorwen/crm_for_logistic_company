import type { ProcessHistoryEventType } from '../domain/history/ProcessHistory';
import type { EntityId } from '../domain/shared/Identifiers';
import { GetProcessTitle } from './GetProcessTitle';
import { WriteProcessHistory } from './WriteProcessHistory';
import type { GovernanceLogger, GovernanceTransaction } from './ports/ProcessGovernanceRepository';

const PARENT_FIELD = 'parent_processes';
const PARENT_FIELD_LABEL = 'Родительские процессы';

export interface RecordParentChangeInput {
  eventType: Extract<ProcessHistoryEventType, 'parent_added' | 'parent_removed'>;
  processId: EntityId;
  parentProcessId: EntityId;
  transaction?: GovernanceTransaction;
  context?: unknown;
}

export class RecordParentChange {
  constructor(
    private readonly getProcessTitle: GetProcessTitle,
    private readonly writeHistory: WriteProcessHistory,
    private readonly logger: GovernanceLogger,
  ) {}

  async execute(input: RecordParentChangeInput): Promise<void> {
    let parentTitle = String(input.parentProcessId);
    try {
      parentTitle = await this.getProcessTitle.execute(input.parentProcessId, input.transaction);
    } catch (error) {
      this.logger.error('Не удалось получить название родительского процесса для истории', error, {
        processId: String(input.processId),
        parentProcessId: String(input.parentProcessId),
      });
    }
    await this.writeHistory.execute({
      entry: {
        processId: String(input.processId),
        eventType: input.eventType,
        fieldName: PARENT_FIELD,
        fieldLabel: PARENT_FIELD_LABEL,
        oldValue: input.eventType === 'parent_removed' ? parentTitle : null,
        newValue: input.eventType === 'parent_added' ? parentTitle : null,
      },
      transaction: input.transaction,
      context: input.context,
    });
  }
}
