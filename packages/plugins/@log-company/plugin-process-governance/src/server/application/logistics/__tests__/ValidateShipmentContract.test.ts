/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import type { LogisticsRepository } from '../ports/LogisticsRepository';
import { ValidateShipmentContract } from '../ValidateShipmentContract';

function setup(isLinked: boolean) {
  const repository = {
    isContractLinkedToCompany: vi.fn(async () => isLinked),
  } as unknown as LogisticsRepository;
  return { repository, action: new ValidateShipmentContract(repository) };
}

describe('ValidateShipmentContract', () => {
  it('allows a contract linked to the selected company', async () => {
    const { action, repository } = setup(true);

    await expect(action.execute({ companyId: 'company-1', contractId: 'contract-1' })).resolves.toBeUndefined();
    expect(repository.isContractLinkedToCompany).toHaveBeenCalledWith('contract-1', 'company-1', undefined);
  });

  it('allows a shipment without a contract', async () => {
    const { action, repository } = setup(false);

    await expect(action.execute({ companyId: 'company-1', contractId: null })).resolves.toBeUndefined();
    expect(repository.isContractLinkedToCompany).not.toHaveBeenCalled();
  });

  it('rejects a contract belonging to another company', async () => {
    const { action } = setup(false);

    await expect(action.execute({ companyId: 'company-1', contractId: 'contract-2' })).rejects.toMatchObject({
      code: 'SHIPMENT_CONTRACT_COMPANY_MISMATCH',
      message: 'Выбранный контракт не привязан к указанной компании.',
    });
  });
});
