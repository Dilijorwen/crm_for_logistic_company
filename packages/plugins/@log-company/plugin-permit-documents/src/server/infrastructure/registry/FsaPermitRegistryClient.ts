/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { PermitDocumentType } from '../../domain/permit-document/PermitDocumentPolicy';
import type { RegistryDocument, RegistryDocumentStatus } from '../../domain/permit-document/RegistryDocument';
import { RegistryError } from '../../domain/permit-document/RegistryErrors';
import type { TechnicalRegulationCandidate } from '../../application/ports/PermitDocumentRepository';
import type { JsonHttpRequest, JsonHttpResponse, JsonHttpTransport } from '../http/JsonHttpTransport';
import { FsaAuthTokenProvider } from './FsaAuthTokenProvider';
import { FsaResponseParser } from './FsaResponseParser';

type FsaDocumentType = Exclude<PermitDocumentType, 'state_registration_certificate'>;

export class FsaPermitRegistryClient {
  constructor(
    private readonly transport: JsonHttpTransport,
    private readonly tokenProvider: FsaAuthTokenProvider,
    private readonly parser: FsaResponseParser,
    private readonly baseUrl: string,
  ) {}

  async findByTitle(documentType: FsaDocumentType, title: string): Promise<RegistryDocument | null> {
    const response = await this.search(documentType, title);
    const externalId = this.parser.findExactSearchId(response.body, title);
    return externalId ? this.getByExternalId(documentType, externalId) : null;
  }

  async findStatusByTitle(documentType: FsaDocumentType, title: string): Promise<RegistryDocumentStatus | null> {
    const response = await this.search(documentType, title);
    return this.parser.parseSearchStatus(documentType, response.body, title);
  }

  private async search(documentType: FsaDocumentType, title: string): Promise<JsonHttpResponse> {
    const declaration = documentType === 'declaration_of_conformity';
    const response = await this.authorizedRequest({
      method: 'POST',
      url: `${this.baseUrl}${
        declaration ? '/api/v1/rds/common/declarations/get' : '/api/v1/rss/common/certificates/get'
      }`,
      body: {
        size: 1,
        page: 0,
        filter: {
          columnsSearch: [
            declaration ? { name: 'number', search: title, type: 0 } : { column: 'number', search: title },
          ],
        },
      },
    });
    this.assertSuccess(response);
    return response;
  }

  async getByExternalId(documentType: FsaDocumentType, externalId: string): Promise<RegistryDocument | null> {
    const declaration = documentType === 'declaration_of_conformity';
    const response = await this.authorizedRequest({
      method: 'GET',
      url: `${this.baseUrl}${
        declaration ? '/api/v1/rds/common/declarations' : '/api/v1/rss/common/certificates'
      }/${encodeURIComponent(externalId)}`,
    });
    if (response.status === 404) {
      return null;
    }
    this.assertSuccess(response);
    const document = this.parser.parseCard(documentType, response.body);
    if (document.externalId !== externalId) {
      throw new RegistryError('INVALID_REGISTRY_RESPONSE', 'FSA card ID does not match the requested ID.', false);
    }
    return document;
  }

  async getTechnicalRegulations(fsaIds: readonly number[]): Promise<TechnicalRegulationCandidate[]> {
    if (fsaIds.length === 0) {
      return [];
    }
    const response = await this.authorizedRequest({
      method: 'POST',
      url: `${this.baseUrl}/nsi/api/multi`,
      body: {
        items: {
          validationFormNormDoc: [{ id: [...fsaIds], fields: ['id', 'masterId', 'name', 'docNum'] }],
        },
      },
    });
    this.assertSuccess(response);
    return this.parser.parseTechnicalRegulations(response.body);
  }

  private async authorizedRequest(request: JsonHttpRequest): Promise<JsonHttpResponse> {
    let token = await this.tokenProvider.getToken();
    let response = await this.transport.request({
      ...request,
      headers: { ...request.headers, Authorization: `Bearer ${token}` },
    });
    if (response.status !== 401) {
      return response;
    }
    token = await this.tokenProvider.getToken(true);
    response = await this.transport.request({
      ...request,
      headers: { ...request.headers, Authorization: `Bearer ${token}` },
    });
    return response;
  }

  private assertSuccess(response: JsonHttpResponse): void {
    if (response.status >= 200 && response.status < 300) {
      return;
    }
    if (response.status === 401 || response.status === 403) {
      throw new RegistryError('REGISTRY_AUTHENTICATION_FAILED', 'FSA authorization failed.', false);
    }
    throw new RegistryError(
      response.status === 408 || response.status === 429 || response.status >= 500
        ? 'REGISTRY_TEMPORARY_UNAVAILABLE'
        : 'INVALID_REGISTRY_RESPONSE',
      `FSA request failed with HTTP ${response.status}.`,
      response.status === 408 || response.status === 429 || response.status >= 500,
    );
  }
}
