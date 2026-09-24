/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { sameIdentifier, type EntityId } from '../shared/Identifiers';
import { LogisticsError } from './LogisticsError';

export function assertRunParentsDoNotContainRun(runId: EntityId, parentIds: EntityId[]): void {
  if (parentIds.some((parentId) => sameIdentifier(parentId, runId))) {
    throw new LogisticsError('RUN_PARENT_SELF', 'Нельзя выбрать текущий рейс как родительский.');
  }
}

export function assertRunParentsDoNotCreateCycle(hasCycle: boolean): void {
  if (hasCycle) {
    throw new LogisticsError('RUN_PARENT_CYCLE', 'Нельзя добавить родительский рейс: связь создаст цикл.');
  }
}
