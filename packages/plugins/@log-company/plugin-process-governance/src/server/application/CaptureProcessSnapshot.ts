import type { EntityId } from '../domain/shared/Identifiers';
import { ProcessSnapshotStore } from './ProcessSnapshotStore';
import type {
  GovernanceLogger,
  GovernanceTransaction,
  ProcessGovernanceRepository,
  ProcessValuesSnapshot,
} from './ports/ProcessGovernanceRepository';

export interface CaptureProcessSnapshotInput {
  processId: EntityId;
  transaction?: GovernanceTransaction;
  snapshotScope?: unknown;
  fallbackSnapshot?: ProcessValuesSnapshot;
}

export class CaptureProcessSnapshot {
  constructor(
    private readonly repository: ProcessGovernanceRepository,
    private readonly snapshots: ProcessSnapshotStore,
    private readonly logger: GovernanceLogger,
  ) {}

  async execute(input: CaptureProcessSnapshotInput): Promise<void> {
    try {
      const fields = this.repository.getTrackedFields();
      const snapshot =
        (await this.repository.findProcessValues(input.processId, fields, input.transaction)) || input.fallbackSnapshot;
      if (snapshot) {
        this.snapshots.save(input.processId, snapshot, input.snapshotScope);
      }
    } catch (error) {
      if (input.fallbackSnapshot) {
        this.snapshots.save(input.processId, input.fallbackSnapshot, input.snapshotScope);
      }
      this.logger.error('Не удалось сохранить снимок процесса перед обновлением', error, {
        processId: String(input.processId),
      });
    }
  }
}
