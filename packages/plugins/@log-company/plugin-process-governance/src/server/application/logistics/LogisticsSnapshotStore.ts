/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { LogisticsEntityKind } from '../../domain/logistics/LogisticsHistory';
import type { EntityId } from '../../domain/shared/Identifiers';
import type { LogisticsValuesSnapshot } from './ports/LogisticsRepository';

const MAX_FALLBACK_SNAPSHOTS = 1_000;

export class LogisticsSnapshotStore {
  private readonly fallbackSnapshots = new Map<string, LogisticsValuesSnapshot>();
  private readonly scopedSnapshots = new WeakMap<object, Map<string, LogisticsValuesSnapshot>>();

  save(entityKind: LogisticsEntityKind, entityId: EntityId, snapshot: LogisticsValuesSnapshot, scope?: unknown): void {
    const snapshots = this.snapshotsFor(scope);
    const key = this.key(entityKind, entityId);
    if (snapshots.has(key)) {
      return;
    }
    snapshots.set(key, snapshot);
    if (snapshots === this.fallbackSnapshots && snapshots.size > MAX_FALLBACK_SNAPSHOTS) {
      const oldestKey = snapshots.keys().next().value;
      if (oldestKey) {
        snapshots.delete(oldestKey);
      }
    }
  }

  take(entityKind: LogisticsEntityKind, entityId: EntityId, scope?: unknown): LogisticsValuesSnapshot | null {
    const snapshots = this.snapshotsFor(scope);
    const key = this.key(entityKind, entityId);
    const snapshot = snapshots.get(key) ?? null;
    snapshots.delete(key);
    return snapshot;
  }

  private key(entityKind: LogisticsEntityKind, entityId: EntityId): string {
    return `${entityKind}:${String(entityId)}`;
  }

  private snapshotsFor(scope?: unknown): Map<string, LogisticsValuesSnapshot> {
    if ((typeof scope !== 'object' || scope === null) && typeof scope !== 'function') {
      return this.fallbackSnapshots;
    }
    const objectScope = scope as object;
    const existing = this.scopedSnapshots.get(objectScope);
    if (existing) {
      return existing;
    }
    const snapshots = new Map<string, LogisticsValuesSnapshot>();
    this.scopedSnapshots.set(objectScope, snapshots);
    return snapshots;
  }
}
