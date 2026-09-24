/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  assertRunParentsDoNotContainRun,
  assertRunParentsDoNotCreateCycle,
} from '../../domain/logistics/RunHierarchyPolicy';
import { uniqueIdentifiers, type EntityId } from '../../domain/shared/Identifiers';
import type { LogisticsRepository, LogisticsTransaction } from './ports/LogisticsRepository';

export interface ValidateRunParentsInput {
  runId: EntityId | null;
  parentIds: EntityId[];
  transaction?: LogisticsTransaction;
}

export class ValidateRunParents {
  constructor(private readonly repository: LogisticsRepository) {}

  async execute(input: ValidateRunParentsInput): Promise<void> {
    if (input.runId === null) {
      return;
    }
    const parentIds = uniqueIdentifiers(input.parentIds);
    if (parentIds.length === 0) {
      return;
    }
    assertRunParentsDoNotContainRun(input.runId, parentIds);
    await this.repository.lockRunParentGraph(input.transaction);
    assertRunParentsDoNotCreateCycle(
      await this.repository.runParentSelectionCreatesCycle(input.runId, parentIds, input.transaction),
    );
  }
}
