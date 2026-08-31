/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { PermitDocumentType } from '../../domain/permit-document/PermitDocumentPolicy';
import {
  InvalidRegistryDocumentError,
  mapFsaStatus,
  type RegistryDocument,
} from '../../domain/permit-document/RegistryDocument';
import { asArray, asRecord, nullableString, numberValue, stringValue } from './RegistryValueReader';

export class FsaResponseParser {
  findExactSearchId(body: unknown, title: string): string | null {
    const exactItem = asArray(asRecord(body).items)
      .map(asRecord)
      .find((item) => stringValue(item.number)?.trim() === title.trim());
    const id = exactItem ? numberValue(exactItem.id) : null;
    return id === null ? null : String(id);
  }

  parseCard(
    documentType: Exclude<PermitDocumentType, 'state_registration_certificate'>,
    body: unknown,
  ): RegistryDocument {
    const card = asRecord(body);
    const statusId = numberValue(card.idStatus);
    const status = statusId === null ? null : mapFsaStatus(statusId);
    if (status === null) {
      throw new InvalidRegistryDocumentError('FSA returned an unsupported document status.');
    }
    const declaration = documentType === 'declaration_of_conformity';
    const externalId = numberValue(declaration ? card.idDeclaration : card.idCertificate);
    const product = asRecord(card.product);
    const technicalRegulations = asArray(card.idTechnicalReglaments).map(numberValue);
    if (externalId === null || technicalRegulations.some((value) => value === null)) {
      throw new InvalidRegistryDocumentError('FSA card identifiers are missing or invalid.');
    }

    return {
      externalId: String(externalId),
      externalStatus: String(statusId),
      documentName: stringValue(card.number) || '',
      documentType,
      validFrom: stringValue(declaration ? card.declRegDate : card.certRegDate) || '',
      validUntil: this.normalizeDate(nullableString(declaration ? card.declEndDate : card.certEndDate)),
      status,
      productInformation: stringValue(product.fullName) || '',
      technicalRegulations: technicalRegulations.map((fsaId) => ({ source: 'FSA' as const, fsaId: fsaId as number })),
    };
  }

  parseTechnicalRegulations(body: unknown): Array<{ fsaId: number; docNum: string; name: string | null }> {
    return asArray(asRecord(body).validationFormNormDoc).map((value) => {
      const record = asRecord(value);
      const fsaId = numberValue(record.id);
      const docNum = stringValue(record.docNum)?.trim();
      if (fsaId === null || !docNum) {
        throw new InvalidRegistryDocumentError('FSA technical regulation response is incomplete.');
      }
      return { fsaId, docNum, name: nullableString(record.name)?.trim() || null };
    });
  }

  private normalizeDate(value: string | null): string | null {
    if (value === null) {
      return null;
    }
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    const localizedMatch = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
    return localizedMatch ? `${localizedMatch[3]}-${localizedMatch[2]}-${localizedMatch[1]}` : value;
  }
}
