import { formatPlainHistoryValue } from '../domain/history/ProcessHistory';
import { extractIdentifier, type EntityId } from '../domain/shared/Identifiers';
import { ProcessSnapshotStore } from './ProcessSnapshotStore';
import { WriteProcessHistory } from './WriteProcessHistory';
import type {
  GovernanceLogger,
  GovernanceTransaction,
  ProcessGovernanceRepository,
  TrackedProcessField,
} from './ports/ProcessGovernanceRepository';

export interface RecordProcessFieldChangesInput {
  processId: EntityId;
  transaction?: GovernanceTransaction;
  snapshotScope?: unknown;
  context?: unknown;
}

export class RecordProcessFieldChanges {
  constructor(
    private readonly repository: ProcessGovernanceRepository,
    private readonly snapshots: ProcessSnapshotStore,
    private readonly writeHistory: WriteProcessHistory,
    private readonly logger: GovernanceLogger,
  ) {}

  async execute(input: RecordProcessFieldChangesInput): Promise<void> {
    const before = this.snapshots.take(input.processId, input.snapshotScope);
    if (!before) {
      return;
    }
    const fields = this.repository.getTrackedFields();
    const after = await this.repository.findProcessValues(input.processId, fields, input.transaction);
    if (!after) {
      return;
    }

    for (const field of fields) {
      try {
        const oldValue = await this.formatValue(field, before[field.name], input.transaction);
        const newValue = await this.formatValue(field, after[field.name], input.transaction);
        if (oldValue === newValue) {
          continue;
        }
        await this.writeHistory.execute({
          entry: {
            processId: String(input.processId),
            eventType: 'field_changed',
            fieldName: field.name,
            fieldLabel: field.label,
            oldValue,
            newValue,
          },
          transaction: input.transaction,
          context: input.context,
        });
      } catch (error) {
        this.logger.error('Не удалось записать изменение поля процесса', error, {
          processId: String(input.processId),
          field: field.name,
        });
      }
    }
  }

  private async formatValue(
    field: TrackedProcessField,
    value: unknown,
    transaction?: GovernanceTransaction,
  ): Promise<string> {
    if (field.kind === 'belongsTo') {
      const identifier = extractIdentifier(value, field.targetKey || 'id');
      if (identifier === null || !field.targetCollection) {
        return '';
      }
      try {
        return await this.repository.getRecordLabel(
          field.targetCollection,
          identifier,
          field.targetKey || 'id',
          transaction,
        );
      } catch (error) {
        this.logger.error('Не удалось получить подпись связанной записи', error, {
          field: field.name,
          target: field.targetCollection,
          id: String(identifier),
        });
        return String(identifier);
      }
    }

    const enumOption = field.enumOptions?.find((option) => String(option.value) === String(value));
    return enumOption?.label || formatPlainHistoryValue(value);
  }
}
