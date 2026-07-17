import { isEmptyValue } from '../domain/shared/Identifiers';
import type { GovernanceTransaction, ProcessGovernanceRepository } from './ports/ProcessGovernanceRepository';

export interface AssignProcessNumberInput {
  isNewRecord: boolean;
  previousNumber: unknown;
  currentNumber: unknown;
  transaction?: GovernanceTransaction;
}

export class AssignProcessNumber {
  constructor(private readonly repository: ProcessGovernanceRepository) {}

  async execute(input: AssignProcessNumberInput): Promise<unknown> {
    if (!input.isNewRecord && !isEmptyValue(input.previousNumber)) {
      return input.previousNumber;
    }
    if (!input.isNewRecord && !isEmptyValue(input.currentNumber)) {
      return input.currentNumber;
    }
    return this.repository.nextProcessNumber(input.transaction);
  }
}
