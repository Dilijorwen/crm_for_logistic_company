/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export class PermitDocumentNumberingError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PermitDocumentNumberingError';
  }
}

export function permitDocumentIdentifier(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const identifier = (value as { id?: unknown }).id;
    if (identifier != null) return permitDocumentIdentifier(identifier);
    throw new PermitDocumentNumberingError('INVALID_RELATED_DOCUMENT', 'Выберите один существующий документ.');
  }
  if (
    (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') &&
    /^[1-9]\d*$/.test(String(value))
  ) {
    return String(value);
  }
  throw new PermitDocumentNumberingError('INVALID_RELATED_DOCUMENT', 'Выберите один существующий документ.');
}

export function assertCanPairPermitDocument(
  documentId: string | null,
  related: { id: string; internalNumber: string; relatedDocumentId: string | null } | null,
): asserts related is { id: string; internalNumber: string; relatedDocumentId: string | null } {
  if (!related) {
    throw new PermitDocumentNumberingError('RELATED_DOCUMENT_NOT_FOUND', 'Связанный документ не найден.');
  }
  if (related.id === documentId) {
    throw new PermitDocumentNumberingError('SELF_RELATED_DOCUMENT', 'Документ нельзя связать с самим собой.');
  }
  if (related.relatedDocumentId !== null) {
    throw new PermitDocumentNumberingError(
      'RELATED_DOCUMENT_ALREADY_PAIRED',
      'У выбранного документа уже есть связанный документ.',
    );
  }
  if (!/^[1-9]\d*$/.test(related.internalNumber)) {
    throw new PermitDocumentNumberingError(
      'INVALID_INTERNAL_NUMBER',
      'У выбранного документа отсутствует внутренний номер.',
    );
  }
}

export function assertPermitDocumentNumberingUnchanged(
  current: { internalNumber: unknown; relatedDocumentId: unknown },
  saved: { internalNumber: unknown; relatedDocumentId: unknown },
): void {
  if (String(current.internalNumber) !== String(saved.internalNumber)) {
    throw new PermitDocumentNumberingError(
      'INTERNAL_NUMBER_READ_ONLY',
      'Внутренний номер назначается автоматически и недоступен для изменения.',
    );
  }
  if (permitDocumentIdentifier(current.relatedDocumentId) !== permitDocumentIdentifier(saved.relatedDocumentId)) {
    throw new PermitDocumentNumberingError(
      'RELATED_DOCUMENT_READ_ONLY',
      'Связанный документ можно выбрать только при создании.',
    );
  }
}
