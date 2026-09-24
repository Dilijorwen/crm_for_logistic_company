/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  InvalidRegistryDocumentError,
  mapEaeuStatus,
  type RegistryDocument,
  type RegistryDocumentStatus,
} from '../../domain/permit-document/RegistryDocument';
import { parseEaeuTechnicalRegulations } from '../../domain/permit-document/TechnicalRegulationParser';
import { asArray, asRecord, nullableString, stringValue } from './RegistryValueReader';

export class EaeuResponseParser {
  findExactSearchId(body: unknown, title: string): string | null {
    const exactItem = this.findExactSearchItem(body, title);
    return exactItem ? stringValue(exactItem.id)?.trim() || null : null;
  }

  parseSearchStatus(body: unknown, title: string): RegistryDocumentStatus | null {
    const item = this.findExactSearchItem(body, title);
    if (!item) {
      return null;
    }
    const data = asRecord(item.data);
    const externalId = stringValue(item.id)?.trim() || '';
    const statusValue = nullableString(asRecord(data.STATUS).name);
    const status = mapEaeuStatus(statusValue);
    if (!externalId || status === null) {
      throw new InvalidRegistryDocumentError('EAEU search result identity or status is invalid.');
    }
    return {
      externalId,
      externalStatus: statusValue,
      documentName: stringValue(data.NUMB_DOC)?.trim() || '',
      documentType: 'state_registration_certificate',
      status,
    };
  }

  parseCard(body: unknown): RegistryDocument {
    const card = asRecord(body);
    const data = asRecord(card.data);
    const statusValue = nullableString(asRecord(data.STATUS).name);
    const status = mapEaeuStatus(statusValue);
    if (status === null) {
      throw new InvalidRegistryDocumentError('EAEU returned an unsupported document status.');
    }
    const technicalRegulationTexts = asArray(data.DOC_GIGHARK)
      .map((value) => stringValue(asRecord(asRecord(value).sourceData).DOC_GIGHARK_NAME))
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    return {
      externalId: stringValue(card.id)?.trim() || '',
      externalStatus: statusValue,
      documentName: stringValue(data.NUMB_DOC)?.trim() || '',
      documentType: 'state_registration_certificate',
      validFrom: stringValue(data.DATE_DOC)?.trim() || '',
      validUntil: null,
      status,
      productInformation: stringValue(data.NAME_PROD)?.trim() || '',
      technicalRegulations: parseEaeuTechnicalRegulations(technicalRegulationTexts).map((item) => ({
        source: 'EAEU' as const,
        docNum: item.docNum,
        name: item.name,
      })),
    };
  }

  private findExactSearchItem(body: unknown, title: string): Record<string, unknown> | null {
    return (
      asArray(body)
        .map(asRecord)
        .find((item) => stringValue(asRecord(item.data).NUMB_DOC)?.trim() === title.trim()) || null
    );
  }
}
