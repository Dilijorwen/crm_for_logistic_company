/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { toCalendarDate, type PermitDocumentStatus } from './PermitDocumentPolicy';

export const PERMIT_DOCUMENT_CATEGORIES = ['ordinary', 'rented', 'voluntary'] as const;
export type PermitDocumentCategory = (typeof PERMIT_DOCUMENT_CATEGORIES)[number];

export class PermitDocumentCategoryError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PermitDocumentCategoryError';
  }
}

export function permitDocumentCategory(value: unknown): PermitDocumentCategory {
  if (value === undefined || value === null) return 'ordinary';
  if (PERMIT_DOCUMENT_CATEGORIES.some((category) => category === value)) return value as PermitDocumentCategory;
  throw new PermitDocumentCategoryError('INVALID_DOCUMENT_CATEGORY', 'Выберите категорию документа.');
}

export function permitDocumentToday(now: Date): string {
  const VLADIVOSTOK_OFFSET_MS = 10 * 60 * 60 * 1000;
  return new Date(now.getTime() + VLADIVOSTOK_OFFSET_MS).toISOString().slice(0, 10);
}

export function voluntaryDocumentStatus(validUntil: string, today: string): PermitDocumentStatus {
  return validUntil < today ? 'terminated' : 'valid';
}

export function permitDocumentPeriod(input: {
  category: PermitDocumentCategory;
  validFrom: unknown;
  validUntil: unknown;
  rentalFrom: unknown;
  rentalUntil: unknown;
}): { from: string | null; until: string | null } {
  return {
    from: toCalendarDate(input.category === 'rented' ? input.rentalFrom : input.validFrom),
    until: toCalendarDate(input.category === 'rented' ? input.rentalUntil : input.validUntil),
  };
}

export function validatePermitDocumentCategory(input: {
  category: PermitDocumentCategory;
  documentType: unknown;
  companyId: unknown;
  relatedDocumentId: unknown;
  validFrom: unknown;
  validUntil: unknown;
  rentalFrom: unknown;
  rentalUntil: unknown;
  productInformation: unknown;
  manufacturerName: unknown;
  manufacturerAddress: unknown;
  regulationCount: number;
  attachmentCount: number;
}): void {
  if (input.category === 'rented') {
    if (input.companyId != null && input.companyId !== '') {
      throw new PermitDocumentCategoryError(
        'RENTED_DOCUMENT_COMPANY',
        'У арендованного документа не должно быть компании.',
      );
    }
    const from = toCalendarDate(input.rentalFrom);
    const until = toCalendarDate(input.rentalUntil);
    if (!from || !until || until < from) {
      throw new PermitDocumentCategoryError(
        'INVALID_RENTAL_PERIOD',
        'Укажите корректные даты начала и окончания аренды.',
      );
    }
  } else if (input.rentalFrom != null || input.rentalUntil != null) {
    throw new PermitDocumentCategoryError(
      'UNEXPECTED_RENTAL_PERIOD',
      'Срок аренды доступен только арендованным документам.',
    );
  }
  if (input.category !== 'voluntary') return;
  if (input.documentType !== 'certificate_of_conformity') {
    throw new PermitDocumentCategoryError('VOLUNTARY_DOCUMENT_TYPE', 'Добровольный документ может быть только СС.');
  }
  if (input.relatedDocumentId != null && input.relatedDocumentId !== '') {
    throw new PermitDocumentCategoryError(
      'VOLUNTARY_DOCUMENT_PAIR',
      'Добровольные документы нельзя связывать с другими документами.',
    );
  }
  const from = toCalendarDate(input.validFrom);
  const until = toCalendarDate(input.validUntil);
  const missing: string[] = [];
  if (!input.companyId) missing.push('Компания');
  if (!from) missing.push('Действует с');
  if (!until) missing.push('Действует до');
  for (const [label, value] of [
    ['Сведения о продукции', input.productInformation],
    ['Изготовитель', input.manufacturerName],
    ['Адрес изготовителя', input.manufacturerAddress],
  ]) {
    if (typeof value !== 'string' || !value.trim()) missing.push(String(label));
  }
  if (input.regulationCount < 1) missing.push('Технические регламенты');
  if (input.attachmentCount < 1) missing.push('Документы');
  if (missing.length) {
    throw new PermitDocumentCategoryError(
      'INCOMPLETE_VOLUNTARY_DOCUMENT',
      `Заполните обязательные поля добровольного документа: ${missing.map((label) => `«${label}»`).join(', ')}.`,
    );
  }
  if (from && until && until < from) {
    throw new PermitDocumentCategoryError(
      'INVALID_VOLUNTARY_PERIOD',
      'Дата окончания действия не может быть раньше даты начала.',
    );
  }
}
