/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import {
  buildPermitDocumentName,
  mapEaeuStatus,
  mapFsaStatus,
  mapSwisStatus,
  validateRegistryDocument,
} from '../RegistryDocument';
import { parseEaeuTechnicalRegulations } from '../TechnicalRegulationParser';

describe('registry document normalization policy', () => {
  it('builds names with registry dates for FSA documents', () => {
    expect(
      buildPermitDocumentName(
        ' ЕАЭС N RU Д-CN.РА07.В.50111/26 ',
        'declaration_of_conformity',
        '2026-08-24',
        '2027-08-23',
      ),
    ).toBe('ЕАЭС N RU Д-CN.РА07.В.50111/26 от 24.08.2026 до 23.08.2027');
    expect(
      buildPermitDocumentName('ЕАЭС RU С-CN.НМ16.В.00188/26', 'certificate_of_conformity', '2026-08-26', '2031-08-25'),
    ).toBe('ЕАЭС RU С-CN.НМ16.В.00188/26 от 26.08.2026 до 25.08.2031');
  });

  it('builds an open-ended name and falls back to the number before synchronization', () => {
    expect(
      buildPermitDocumentName('BY.70.06.01.001.R.001807.08.26', 'state_registration_certificate', '2026-08-27', null),
    ).toBe('BY.70.06.01.001.R.001807.08.26 от 27.08.2026');
    expect(
      buildPermitDocumentName('ЕАЭС N RU Д-RU.РА08.А.38696/26', 'declaration_of_conformity', '2026-09-16', null),
    ).toBe('ЕАЭС N RU Д-RU.РА08.А.38696/26 от 16.09.2026');
    expect(buildPermitDocumentName(' DOC-1 ', 'declaration_of_conformity', null, null)).toBe('DOC-1');
  });

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

  it('maps every SWIS certificate and declaration status', () => {
    for (const status of ['Действует', 'Продлен', 'Продлена', 'Возобновлен', 'Возобновлена']) {
      expect(mapSwisStatus(status)).toBe('valid');
    }
    expect(mapSwisStatus('Приостановлен')).toBe('suspended');
    expect(mapSwisStatus('Приостановлена')).toBe('suspended');
    expect(mapSwisStatus('Прекращен')).toBe('terminated');
    expect(mapSwisStatus('Прекращена')).toBe('terminated');
    expect(mapSwisStatus('Неизвестно')).toBeNull();
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

  it('accepts an open-ended declaration for a single product', () => {
    expect(() =>
      validateRegistryDocument({
        externalId: '21892284',
        externalStatus: '6',
        documentName: 'ЕАЭС N RU Д-RU.РА08.А.38696/26',
        documentType: 'declaration_of_conformity',
        validFrom: '2026-09-16',
        validUntil: null,
        status: 'valid',
        productInformation: 'лифт',
        technicalRegulations: [{ source: 'FSA', fsaId: 6 }],
      }),
    ).not.toThrow();
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

  it('extracts a technical regulation name written before the document number', () => {
    expect(
      parseEaeuTechnicalRegulations([
        'Технического регламента Таможенного союза "О безопасности игрушек" (ТР ТС 008/2011)',
      ]),
    ).toEqual([{ source: 'EAEU', docNum: 'ТР ТС 008/2011', name: 'О безопасности игрушек' }]);
  });
});
