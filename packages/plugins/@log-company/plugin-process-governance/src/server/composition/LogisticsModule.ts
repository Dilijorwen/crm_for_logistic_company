/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { AssignImmutableNumber } from '../application/logistics/AssignImmutableNumber';
import { CaptureLogisticsSnapshot } from '../application/logistics/CaptureLogisticsSnapshot';
import { LogisticsSnapshotStore } from '../application/logistics/LogisticsSnapshotStore';
import { NormalizeShipmentNumericFields } from '../application/logistics/NormalizeShipmentNumericFields';
import { RecordLogisticsCreated } from '../application/logistics/RecordLogisticsCreated';
import { RecordLogisticsFieldChanges } from '../application/logistics/RecordLogisticsFieldChanges';
import { RecordLogisticsRelationChange } from '../application/logistics/RecordLogisticsRelationChange';
import { RefreshShipmentDisplayName } from '../application/logistics/RefreshShipmentDisplayName';
import { ResolveRunVehicle } from '../application/logistics/ResolveRunVehicle';
import { ValidateRunParents } from '../application/logistics/ValidateRunParents';
import { ValidateShipmentContract } from '../application/logistics/ValidateShipmentContract';
import { ValidateShipmentDeletion } from '../application/logistics/ValidateShipmentDeletion';
import { WriteLogisticsHistory } from '../application/logistics/WriteLogisticsHistory';
import { NocoBaseGovernanceLogger } from '../infrastructure/nocobase/NocoBaseGovernanceLogger';
import { LogisticsIntegrityGuard } from '../infrastructure/persistence/nocobase/LogisticsIntegrityGuard';
import { NocoBaseLogisticsRepository } from '../infrastructure/persistence/nocobase/NocoBaseLogisticsRepository';
import { LogisticsHooks } from '../interfaces/hooks/LogisticsHooks';
import { LogisticsPreActions } from '../interfaces/http/LogisticsPreActions';

export class LogisticsModule {
  constructor(private readonly plugin: Plugin) {}

  initialize(): void {
    new LogisticsIntegrityGuard(this.plugin).register();
    const repository = new NocoBaseLogisticsRepository(this.plugin);
    const logger = new NocoBaseGovernanceLogger(this.plugin);
    const snapshots = new LogisticsSnapshotStore();
    const history = new WriteLogisticsHistory(repository, logger);
    const validateRunParents = new ValidateRunParents(repository);
    const validateShipmentContract = new ValidateShipmentContract(repository);
    const validateShipmentDeletion = new ValidateShipmentDeletion(repository);

    new LogisticsPreActions(this.plugin, repository, validateRunParents, validateShipmentDeletion).register();
    new LogisticsHooks(this.plugin, repository, {
      assignNumber: new AssignImmutableNumber(repository),
      resolveRunVehicle: new ResolveRunVehicle(repository),
      captureSnapshot: new CaptureLogisticsSnapshot(repository, snapshots, logger),
      normalizeShipmentNumericFields: new NormalizeShipmentNumericFields(),
      recordCreated: new RecordLogisticsCreated(repository, history, logger),
      recordFieldChanges: new RecordLogisticsFieldChanges(repository, snapshots, history, logger),
      recordRelationChange: new RecordLogisticsRelationChange(repository, history),
      validateRunParents,
      validateShipmentContract,
      validateShipmentDeletion,
      refreshShipmentDisplayName: new RefreshShipmentDisplayName(repository),
    }).register();
  }
}
