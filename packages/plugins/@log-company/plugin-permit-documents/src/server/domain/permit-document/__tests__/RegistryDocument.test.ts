/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { mapEaeuStatus, mapFsaStatus, validateRegistryDocument } from '../RegistryDocument';
import { parseEaeuTechnicalRegulations } from '../TechnicalRegulationParser';

describe('registry document normalization policy', () => {
  it('maps every agreed FSA status', () => {
    for (const status of [1, 10, 11, 14, 20, 42]) {
      expect(mapFsaStatus(status)).toBe('terminated');
    }
    for (const status of [3, 5, 6]) {
      expect(mapFsaStatus(status)).toBe('valid');
    }
    expect(mapFsaStatus(15)).toBe('suspended');
    expect(mapFsaStatus(999)).toBeNull();
  });

  it('maps every agreed EAEU status and rejects unknown values', () => {
    expect(mapEaeuStatus(null)).toBe('valid');
    expect(mapEaeuStatus('подписан и действует')).toBe('valid');
    for (const status of [
      'аннулирован',
      'отозван',
      'удален из-за технической ошибки при оформлении',
      'удален в связи с переоформлением',
    ]) {
      expect(mapEaeuStatus(status)).toBe('terminated');
    }
    expect(mapEaeuStatus('неизвестный статус')).toBeNull();
  });

  it('validates mandatory successful card fields', () => {
    expect(() =>
      validateRegistryDocument({
        externalId: '1',
        externalStatus: '6',
        documentName: 'DOC-1',
        documentType: 'declaration_of_conformity',
        validFrom: '2026-01-01',
        validUntil: '2027-01-01',
        status: 'valid',
        productInformation: '',
        technicalRegulations: [],
      }),
    ).toThrow('product information');
  });

  it('extracts and de-duplicates multiple ТР ТС and ТР ЕАЭС references', () => {
    expect(
      parseEaeuTechnicalRegulations([
        'ТР ТС 021/2011 «О безопасности пищевой продукции»; ТР ЕАЭС 022/2011 — Маркировка',
        'ТР ТС 021/2011',
      ]),
    ).toEqual([
      { source: 'EAEU', docNum: 'ТР ТС 021/2011', name: 'О безопасности пищевой продукции' },
      { source: 'EAEU', docNum: 'ТР ЕАЭС 022/2011', name: 'Маркировка' },
    ]);
  });
});
