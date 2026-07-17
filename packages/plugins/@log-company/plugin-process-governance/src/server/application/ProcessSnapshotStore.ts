import type { EntityId } from '../domain/shared/Identifiers';
import type { ProcessValuesSnapshot } from './ports/ProcessGovernanceRepository';

const MAX_SNAPSHOTS = 1_000;

export class ProcessSnapshotStore {
  private readonly fallbackSnapshots = new Map<string, ProcessValuesSnapshot>();
  private readonly scopedSnapshots = new WeakMap<object, Map<string, ProcessValuesSnapshot>>();

  save(processId: EntityId, snapshot: ProcessValuesSnapshot, scope?: unknown): void {
    const key = String(processId);
    const snapshots = this.snapshotsFor(scope);
    snapshots.delete(key);
    snapshots.set(key, snapshot);
    if (snapshots === this.fallbackSnapshots && snapshots.size > MAX_SNAPSHOTS) {
      const oldestKey = snapshots.keys().next().value;
      if (oldestKey) {
        snapshots.delete(oldestKey);
      }
    }
  }

  take(processId: EntityId, scope?: unknown): ProcessValuesSnapshot | null {
    const key = String(processId);
    const snapshots = this.snapshotsFor(scope);
    const snapshot = snapshots.get(key) || null;
    snapshots.delete(key);
    return snapshot;
  }

  private snapshotsFor(scope?: unknown): Map<string, ProcessValuesSnapshot> {
    if ((typeof scope !== 'object' || scope === null) && typeof scope !== 'function') {
      return this.fallbackSnapshots;
    }
    const objectScope = scope as object;
    const existing = this.scopedSnapshots.get(objectScope);
    if (existing) {
      return existing;
    }
    const snapshots = new Map<string, ProcessValuesSnapshot>();
    this.scopedSnapshots.set(objectScope, snapshots);
    return snapshots;
  }
}
