/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { LogisticsEntityKind } from '../../domain/logistics/LogisticsHistory';
import { isEmptyValue } from '../../domain/shared/Identifiers';
import type { LogisticsRepository, LogisticsTransaction } from './ports/LogisticsRepository';

export interface AssignImmutableNumberInput {
  entityKind: LogisticsEntityKind;
  isNewRecord: boolean;
  previousNumber: unknown;
  currentNumber: unknown;
  transaction?: LogisticsTransaction;
}

export class AssignImmutableNumber {
  constructor(private readonly repository: LogisticsRepository) {}

  async execute(input: AssignImmutableNumberInput): Promise<unknown> {
    if (!input.isNewRecord && !isEmptyValue(input.previousNumber)) {
      return input.previousNumber;
    }
    if (!input.isNewRecord && !isEmptyValue(input.currentNumber)) {
      return input.currentNumber;
    }
    return this.repository.nextNumber(input.entityKind, input.transaction);
  }
}
