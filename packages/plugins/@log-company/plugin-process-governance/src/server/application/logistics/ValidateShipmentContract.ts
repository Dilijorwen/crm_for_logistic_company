/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { assertShipmentContractBelongsToCompany } from '../../domain/logistics/ShipmentContractPolicy';
import type { EntityId } from '../../domain/shared/Identifiers';
import type { LogisticsRepository, LogisticsTransaction } from './ports/LogisticsRepository';

export interface ValidateShipmentContractInput {
  companyId: EntityId | null;
  contractId: EntityId | null;
  transaction?: LogisticsTransaction;
}

export class ValidateShipmentContract {
  constructor(private readonly repository: LogisticsRepository) {}

  async execute(input: ValidateShipmentContractInput): Promise<void> {
    if (input.contractId === null) {
      return;
    }
    const isLinked =
      input.companyId !== null &&
      (await this.repository.isContractLinkedToCompany(input.contractId, input.companyId, input.transaction));
    assertShipmentContractBelongsToCompany(isLinked);
  }
}
