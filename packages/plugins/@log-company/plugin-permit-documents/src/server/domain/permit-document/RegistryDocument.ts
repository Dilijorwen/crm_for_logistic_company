/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { PermitDocumentStatus, PermitDocumentType } from './PermitDocumentPolicy';

export interface FsaTechnicalRegulationReference {
  source: 'FSA';
  fsaId: number;
}

export interface EaeuTechnicalRegulationReference {
  source: 'EAEU';
  docNum: string;
  name: string | null;
}

export type TechnicalRegulationReference = FsaTechnicalRegulationReference | EaeuTechnicalRegulationReference;

export interface RegistryDocument {
  externalId: string;
  externalStatus: string | null;
  documentName: string;
  documentType: PermitDocumentType;
  validFrom: string;
  validUntil: string | null;
  status: PermitDocumentStatus;
  productInformation: string;
  technicalRegulations: TechnicalRegulationReference[];
}

const FSA_TERMINATED_STATUSES = new Set([1, 10, 11, 14, 20, 42]);
const FSA_VALID_STATUSES = new Set([3, 5, 6]);

export function mapFsaStatus(value: number): PermitDocumentStatus | null {
  if (FSA_TERMINATED_STATUSES.has(value)) {
    return 'terminated';
  }
  if (FSA_VALID_STATUSES.has(value)) {
    return 'valid';
  }
  return value === 15 ? 'suspended' : null;
}

export function mapEaeuStatus(value: string | null): PermitDocumentStatus | null {
  if (value === null || value.trim().length === 0) {
    return 'valid';
  }
  const normalized = value.trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
  if (normalized === 'подписан и действует') {
    return 'valid';
  }
  if (
    normalized === 'аннулирован' ||
    normalized === 'отозван' ||
    normalized === 'удален из-за технической ошибки при оформлении' ||
    normalized === 'удален в связи с переоформлением'
  ) {
    return 'terminated';
  }
  return null;
}

export function validateRegistryDocument(document: RegistryDocument): void {
  if (document.externalId.trim().length === 0 || document.documentName.trim().length === 0) {
    throw new InvalidRegistryDocumentError('Registry document identity is missing.');
  }
  if (document.productInformation.trim().length === 0) {
    throw new InvalidRegistryDocumentError('Registry product information is missing.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(document.validFrom)) {
    throw new InvalidRegistryDocumentError('Registry registration date is invalid.');
  }
  if (document.documentType === 'state_registration_certificate') {
    if (document.validUntil !== null) {
      throw new InvalidRegistryDocumentError('State registration document must not have an artificial end date.');
    }
    return;
  }
  if (document.validUntil === null || !/^\d{4}-\d{2}-\d{2}$/.test(document.validUntil)) {
    throw new InvalidRegistryDocumentError('Registry end date is missing or invalid.');
  }
  if (document.validUntil < document.validFrom) {
    throw new InvalidRegistryDocumentError('Registry end date is earlier than its registration date.');
  }
}

export class InvalidRegistryDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRegistryDocumentError';
  }
}
