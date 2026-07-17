import type { ProcessHistoryEntry } from '../domain/history/ProcessHistory';
import type {
  GovernanceLogger,
  GovernanceTransaction,
  ProcessGovernanceRepository,
} from './ports/ProcessGovernanceRepository';

export interface WriteProcessHistoryInput {
  entry: ProcessHistoryEntry;
  transaction?: GovernanceTransaction;
  context?: unknown;
}

export class WriteProcessHistory {
  constructor(
    private readonly repository: ProcessGovernanceRepository,
    private readonly logger: GovernanceLogger,
  ) {}

  async execute(input: WriteProcessHistoryInput): Promise<void> {
    if (!this.repository.historyCollectionExists()) {
      this.logger.warn('Коллекция process_history недоступна, событие истории пропущено', {
        processId: input.entry.processId,
        eventType: input.entry.eventType,
      });
      return;
    }
    try {
      await this.repository.createHistory(input.entry, input.transaction, input.context);
    } catch (error) {
      this.logger.error('Не удалось записать историю процесса', error, {
        processId: input.entry.processId,
        eventType: input.entry.eventType,
      });
    }
  }
}
