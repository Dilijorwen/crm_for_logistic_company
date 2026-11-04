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
  permitDocumentCategory,
  permitDocumentPeriod,
  permitDocumentToday,
  validatePermitDocumentCategory,
  voluntaryDocumentStatus,
} from '../PermitDocumentCategoryPolicy';

const complete = {
  category: 'voluntary' as const,
  documentType: 'certificate_of_conformity',
  companyId: '1',
  relatedDocumentId: null,
  validFrom: '2026-01-01',
  validUntil: '2027-01-01',
  rentalFrom: null,
  rentalUntil: null,
  productInformation: 'Продукция',
  manufacturerName: 'Завод',
  manufacturerAddress: 'Адрес',
  regulationCount: 1,
  attachmentCount: 1,
};

describe('permit document category rules', () => {
  it('preserves the default category and rejects invalid categories', () => {
    expect(permitDocumentCategory(undefined)).toBe('ordinary');
    expect(() => permitDocumentCategory('unknown')).toThrow('категорию');
  });
  it.each([
    'companyId',
    'validFrom',
    'validUntil',
    'productInformation',
    'manufacturerName',
    'manufacturerAddress',
  ] as const)('requires voluntary field %s', (field) =>
    expect(() => validatePermitDocumentCategory({ ...complete, [field]: null })).toThrow(),
  );
  it('requires files and regulations and rejects voluntary declarations and pairs', () => {
    expect(() => validatePermitDocumentCategory(complete)).not.toThrow();
    for (const change of [
      { attachmentCount: 0 },
      { regulationCount: 0 },
      { documentType: 'declaration_of_conformity' },
      { relatedDocumentId: '2' },
    ]) {
      expect(() => validatePermitDocumentCategory({ ...complete, ...change })).toThrow();
    }
  });
  it('lists only missing voluntary fields and gives a separate date range error', () => {
    expect(() => validatePermitDocumentCategory({ ...complete, manufacturerAddress: '' })).toThrow(
      'обязательные поля добровольного документа: «Адрес изготовителя»',
    );
    expect(() => validatePermitDocumentCategory({ ...complete, validUntil: '2025-01-01' })).toThrow(
      'Дата окончания действия не может быть раньше даты начала',
    );
  });
  it('keeps real and displayed periods separate and includes the final day', () => {
    expect(
      permitDocumentPeriod({
        category: 'rented',
        validFrom: '2025-01-01',
        validUntil: '2030-01-01',
        rentalFrom: '2026-01-01',
        rentalUntil: '2026-12-31',
      }),
    ).toEqual({ from: '2026-01-01', until: '2026-12-31' });
    expect(voluntaryDocumentStatus('2026-10-23', '2026-10-23')).toBe('valid');
    expect(voluntaryDocumentStatus('2026-10-22', '2026-10-23')).toBe('terminated');
    expect(permitDocumentToday(new Date('2026-10-22T14:00:00Z'))).toBe('2026-10-23');
  });
});
