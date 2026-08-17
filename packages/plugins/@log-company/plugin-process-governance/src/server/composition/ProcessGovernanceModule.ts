/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { AssignProcessNumber } from '../application/AssignProcessNumber';
import { BuildComputedProcessTitle } from '../application/BuildComputedProcessTitle';
import { CaptureProcessSnapshot } from '../application/CaptureProcessSnapshot';
import { GetProcessTitle } from '../application/GetProcessTitle';
import { ProcessSnapshotStore } from '../application/ProcessSnapshotStore';
import { RecordParentChange } from '../application/RecordParentChange';
import { RecordProcessCreated } from '../application/RecordProcessCreated';
import { RecordProcessFieldChanges } from '../application/RecordProcessFieldChanges';
import { RefreshChineseClientProcessTitles } from '../application/RefreshChineseClientProcessTitles';
import { ValidateProcessParents } from '../application/ValidateProcessParents';
import { ValidateProcessStatusChange } from '../application/ValidateProcessStatusChange';
import { WriteProcessHistory } from '../application/WriteProcessHistory';
import { NocoBaseGovernanceLogger } from '../infrastructure/nocobase/NocoBaseGovernanceLogger';
import { NocoBaseGovernanceRuntime } from '../infrastructure/nocobase/NocoBaseGovernanceRuntime';
import { NocoBaseProcessGovernanceRepository } from '../infrastructure/persistence/nocobase/NocoBaseProcessGovernanceRepository';
import { ProcessGovernanceHooks } from '../interfaces/hooks/ProcessGovernanceHooks';
import { ProcessGovernancePreActions } from '../interfaces/http/ProcessGovernancePreActions';

export class ProcessGovernanceModule {
  constructor(private readonly plugin: Plugin) {}

  initialize(): void {
    const repository = new NocoBaseProcessGovernanceRepository(this.plugin);
    const logger = new NocoBaseGovernanceLogger(this.plugin);
    const snapshots = new ProcessSnapshotStore();
    const validateParents = new ValidateProcessParents(repository);
    const validateStatusChange = new ValidateProcessStatusChange(repository);
    const captureSnapshot = new CaptureProcessSnapshot(repository, snapshots, logger);
    const buildComputedTitle = new BuildComputedProcessTitle(repository, logger);
    const writeHistory = new WriteProcessHistory(repository, logger);
    const getProcessTitle = new GetProcessTitle(repository, buildComputedTitle);

    new NocoBaseGovernanceRuntime(this.plugin, logger).configure();
    new ProcessGovernancePreActions(this.plugin, repository, validateParents, validateStatusChange).register();
    new ProcessGovernanceHooks(this.plugin, repository, {
      assignProcessNumber: new AssignProcessNumber(repository),
      buildComputedTitle,
      captureSnapshot,
      recordCreated: new RecordProcessCreated(getProcessTitle, writeHistory),
      recordFieldChanges: new RecordProcessFieldChanges(repository, snapshots, writeHistory, logger),
      recordParentChange: new RecordParentChange(getProcessTitle, writeHistory, logger),
      refreshClientTitles: new RefreshChineseClientProcessTitles(repository, logger),
      validateParents,
      validateStatusChange,
    }).register();
  }
}
