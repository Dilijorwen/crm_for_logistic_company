/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { RegistryDocument, RegistryDocumentStatus } from '../../domain/permit-document/RegistryDocument';
import { RegistryError } from '../../domain/permit-document/RegistryErrors';
import type { TextHttpResponse, TextHttpTransport } from '../http/TextHttpTransport';
import { SwisResponseParser, type SwisPermitDocumentType, type SwisRegistrySummary } from './SwisResponseParser';

const SEARCH_PATHS: Record<SwisPermitDocumentType, string> = {
  declaration_of_conformity: '/Registry/DeclarationOfConformity',
  certificate_of_conformity: '/Registry/CertificateOfConformity',
};
const REQUEST_HEADERS = {
  'Accept-Language': 'ru-RU,ru;q=0.9',
  'User-Agent': 'LogCompanyPermitDocuments/1.0',
};

export class SwisPermitRegistryClient {
  constructor(
    private readonly transport: TextHttpTransport,
    private readonly parser: SwisResponseParser,
    private readonly baseUrl: string,
  ) {}

  async findByTitle(documentType: SwisPermitDocumentType, title: string): Promise<RegistryDocument | null> {
    const summary = await this.search(documentType, title);
    return summary ? this.loadDocument(documentType, summary) : null;
  }

  async findStatusByTitle(documentType: SwisPermitDocumentType, title: string): Promise<RegistryDocumentStatus | null> {
    const summary = await this.search(documentType, title);
    return summary
      ? {
          externalId: summary.externalId,
          externalStatus: summary.externalStatus,
          documentName: summary.documentName,
          documentType,
          status: summary.status,
        }
      : null;
  }

  async getByExternalId(
    documentType: SwisPermitDocumentType,
    externalId: string,
    title: string,
  ): Promise<RegistryDocument | null> {
    const summary = await this.search(documentType, title);
    if (!summary) {
      return null;
    }
    if (summary.externalId.toLocaleLowerCase('en-US') !== externalId.toLocaleLowerCase('en-US')) {
      throw new RegistryError('INVALID_REGISTRY_RESPONSE', 'SWIS search result ID does not match the saved ID.', false);
    }
    return this.loadDocument(documentType, summary);
  }

  private async search(documentType: SwisPermitDocumentType, title: string): Promise<SwisRegistrySummary | null> {
    const query = new URLSearchParams({
      RegisterNumber: title,
      Status: 'Все',
      Agency: 'Все',
      Manufacturer: '',
      RegisterDateFrom: '',
      RegisterDateTo: '',
      EndDateFrom: '',
      EndDateTo: '',
      Declarant: '',
      GoodsHsCode: '',
      GoodsName: '',
      submitButton: 'Найти',
      PageNumber: '1',
    });
    const response = await this.transport.request({
      method: 'GET',
      url: `${this.baseUrl}${SEARCH_PATHS[documentType]}?${query.toString()}`,
      headers: REQUEST_HEADERS,
    });
    this.assertSuccess(response, 'search');
    return this.parser.parseSearch(response.body, title, documentType);
  }

  private async loadDocument(
    documentType: SwisPermitDocumentType,
    summary: SwisRegistrySummary,
  ): Promise<RegistryDocument | null> {
    const response = await this.transport.request({
      method: 'GET',
      url: `${this.baseUrl}/Doc/${encodeURIComponent(summary.externalId)}`,
      headers: REQUEST_HEADERS,
    });
    if (response.status === 404) {
      return null;
    }
    this.assertSuccess(response, 'document');
    return {
      externalId: summary.externalId,
      externalStatus: summary.externalStatus,
      documentName: summary.documentName,
      documentType,
      validFrom: summary.validFrom,
      validUntil: summary.validUntil,
      status: summary.status,
      productInformation: summary.productInformation,
      technicalRegulations: this.parser.parseTechnicalRegulations(response.body),
    };
  }

  private assertSuccess(response: TextHttpResponse, operation: string): void {
    if (response.status >= 200 && response.status < 300) {
      return;
    }
    const isTemporary = response.status === 408 || response.status === 429 || response.status >= 500;
    throw new RegistryError(
      isTemporary ? 'REGISTRY_TEMPORARY_UNAVAILABLE' : 'INVALID_REGISTRY_RESPONSE',
      `SWIS ${operation} request failed with HTTP ${response.status}.`,
      isTemporary,
    );
  }
}
