/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { CompositePermitRegistryGateway } from '../CompositePermitRegistryGateway';
import type { EaeuPermitRegistryClient } from '../EaeuPermitRegistryClient';
import type { FsaPermitRegistryClient } from '../FsaPermitRegistryClient';
import type { SwisPermitRegistryClient } from '../SwisPermitRegistryClient';

function fixture() {
  const fsa = {
    findByTitle: vi.fn(),
    findStatusByTitle: vi.fn(),
    getByExternalId: vi.fn(),
    getTechnicalRegulations: vi.fn(),
  } as unknown as FsaPermitRegistryClient;
  const eaeu = {
    findByTitle: vi.fn(),
    findStatusByTitle: vi.fn(),
    getByExternalId: vi.fn(),
  } as unknown as EaeuPermitRegistryClient;
  const swis = {
    findByTitle: vi.fn(),
    findStatusByTitle: vi.fn(),
    getByExternalId: vi.fn(),
  } as unknown as SwisPermitRegistryClient;
  return { fsa, eaeu, swis, gateway: new CompositePermitRegistryGateway(fsa, eaeu, swis) };
}

describe('CompositePermitRegistryGateway', () => {
  it('routes KG certificates and declarations to SWIS', async () => {
    const { fsa, swis, gateway } = fixture();
    vi.mocked(swis.findByTitle).mockResolvedValue(null);
    vi.mocked(fsa.findByTitle).mockResolvedValue(null);

    await gateway.findByTitle('certificate_of_conformity', 'ЕАЭС KG 417/043.CN.02.08910');
    await gateway.findByTitle('declaration_of_conformity', 'ЕАЭС KG417/013.Д.0002575');
    await gateway.findByTitle('certificate_of_conformity', 'ЕАЭС RU С-CN.РА01.А.00001/26');
    await gateway.findByTitle('declaration_of_conformity', 'ЕАЭС RU Д-CN.РА01.А.00001/26');

    expect(swis.findByTitle).toHaveBeenCalledTimes(2);
    expect(swis.findByTitle).toHaveBeenNthCalledWith(2, 'declaration_of_conformity', 'ЕАЭС KG417/013.Д.0002575');
    expect(fsa.findByTitle).toHaveBeenCalledTimes(2);
  });

  it('uses SWIS for status checks and full refreshes of saved KG certificates', async () => {
    const { fsa, swis, gateway } = fixture();
    vi.mocked(swis.findStatusByTitle).mockResolvedValue(null);
    vi.mocked(swis.getByExternalId).mockResolvedValue(null);
    const title = 'ЕАЭС KG 417/043.CN.02.08910';

    await gateway.findStatusByTitle('certificate_of_conformity', title);
    await gateway.getByExternalId('certificate_of_conformity', 'uuid', title);

    expect(swis.findStatusByTitle).toHaveBeenCalledWith('certificate_of_conformity', title);
    expect(swis.getByExternalId).toHaveBeenCalledWith('certificate_of_conformity', 'uuid', title);
    expect(fsa.findStatusByTitle).not.toHaveBeenCalled();
    expect(fsa.getByExternalId).not.toHaveBeenCalled();
  });

  it('uses SWIS for status checks and full refreshes of saved KG declarations', async () => {
    const { fsa, swis, gateway } = fixture();
    vi.mocked(swis.findStatusByTitle).mockResolvedValue(null);
    vi.mocked(swis.getByExternalId).mockResolvedValue(null);
    const title = 'ЕАЭС KG417/013.Д.0002575';

    await gateway.findStatusByTitle('declaration_of_conformity', title);
    await gateway.getByExternalId('declaration_of_conformity', 'uuid', title);

    expect(swis.findStatusByTitle).toHaveBeenCalledWith('declaration_of_conformity', title);
    expect(swis.getByExternalId).toHaveBeenCalledWith('declaration_of_conformity', 'uuid', title);
    expect(fsa.findStatusByTitle).not.toHaveBeenCalled();
    expect(fsa.getByExternalId).not.toHaveBeenCalled();
  });
});
