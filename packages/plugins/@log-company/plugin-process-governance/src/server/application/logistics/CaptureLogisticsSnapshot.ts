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
import { LogisticsSnapshotStore } from './LogisticsSnapshotStore';
import type {
  LogisticsLogger,
  LogisticsRepository,
  LogisticsTransaction,
  LogisticsValuesSnapshot,
} from './ports/LogisticsRepository';

export interface CaptureLogisticsSnapshotInput {
  entityKind: LogisticsEntityKind;
  entityId: EntityId;
  transaction?: LogisticsTransaction;
  snapshotScope?: unknown;
  fallbackSnapshot?: LogisticsValuesSnapshot;
}

export class CaptureLogisticsSnapshot {
  constructor(
    private readonly repository: LogisticsRepository,
    private readonly snapshots: LogisticsSnapshotStore,
    private readonly logger: LogisticsLogger,
  ) {}

  async execute(input: CaptureLogisticsSnapshotInput): Promise<void> {
    try {
      const fields = this.repository.getTrackedFields(input.entityKind);
      const snapshot =
        (await this.repository.findEntityValues(input.entityKind, input.entityId, fields, input.transaction)) ??
        input.fallbackSnapshot;
      if (snapshot) {
        this.snapshots.save(input.entityKind, input.entityId, snapshot, input.snapshotScope);
      }
    } catch (error) {
      if (input.fallbackSnapshot) {
        this.snapshots.save(input.entityKind, input.entityId, input.fallbackSnapshot, input.snapshotScope);
      }
      this.logger.error('Не удалось сохранить снимок перед обновлением', error, {
        entityKind: input.entityKind,
        entityId: String(input.entityId),
      });
    }
  }
}
