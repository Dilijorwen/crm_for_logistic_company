/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { normalizeVehicleRegistrationNumber } from '../../domain/logistics/VehicleRegistrationNumber';
import type { EntityId } from '../../domain/shared/Identifiers';
import type { LogisticsRepository, LogisticsTransaction } from './ports/LogisticsRepository';

export interface ResolveRunVehicleInput {
  registrationNumber: unknown;
  transaction?: LogisticsTransaction;
}

export interface ResolveRunVehicleResult {
  vehicleId: EntityId;
  registrationNumber: string;
}

export class ResolveRunVehicle {
  constructor(private readonly repository: LogisticsRepository) {}

  async execute(input: ResolveRunVehicleInput): Promise<ResolveRunVehicleResult> {
    const registrationNumber = normalizeVehicleRegistrationNumber(input.registrationNumber);
    const vehicleId = await this.repository.findOrCreateVehicle(registrationNumber, input.transaction);
    return { vehicleId, registrationNumber };
  }
}
