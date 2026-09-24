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
import type { JsonHttpResponse, JsonHttpTransport } from '../http/JsonHttpTransport';
import { EaeuResponseParser } from './EaeuResponseParser';

export interface MoscowDateProvider {
  today(): string;
}

export class IntlMoscowDateProvider implements MoscowDateProvider {
  today(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
}

export class EaeuPermitRegistryClient {
  constructor(
    private readonly transport: JsonHttpTransport,
    private readonly parser: EaeuResponseParser,
    private readonly dateProvider: MoscowDateProvider,
    private readonly baseUrl: string,
  ) {}

  async findByTitle(title: string): Promise<RegistryDocument | null> {
    const response = await this.search(title);
    const externalId = this.parser.findExactSearchId(response.body, title);
    return externalId ? this.getByExternalId(externalId) : null;
  }

  async findStatusByTitle(title: string): Promise<RegistryDocumentStatus | null> {
    const response = await this.search(title);
    return this.parser.parseSearchStatus(response.body, title);
  }

  private async search(title: string): Promise<JsonHttpResponse> {
    const response = await this.transport.request({
      method: 'POST',
      url: `${this.baseUrl}/portal/api/dictionaries/1995/get-list-data`,
      body: {
        date: this.dateProvider.today(),
        offset: 0,
        limit: 13,
        filter: [{ code: 'searchText', value: title, conditionType: 'like' }],
        sort: [],
      },
    });
    this.assertSuccess(response);
    return response;
  }

  async getByExternalId(externalId: string): Promise<RegistryDocument | null> {
    const query = new URLSearchParams({ id: externalId, date: this.dateProvider.today() });
    const response = await this.transport.request({
      method: 'GET',
      url: `${this.baseUrl}/portal/api/dictionaries/1995/get-view-card-data-on-date?${query.toString()}`,
    });
    if (response.status === 404) {
      return null;
    }
    this.assertSuccess(response);
    const document = this.parser.parseCard(response.body);
    if (document.externalId !== externalId) {
      throw new RegistryError('INVALID_REGISTRY_RESPONSE', 'EAEU card ID does not match the requested ID.', false);
    }
    return document;
  }

  private assertSuccess(response: JsonHttpResponse): void {
    if (response.status >= 200 && response.status < 300) {
      return;
    }
    throw new RegistryError(
      response.status === 408 || response.status === 429 || response.status >= 500
        ? 'REGISTRY_TEMPORARY_UNAVAILABLE'
        : 'INVALID_REGISTRY_RESPONSE',
      `EAEU request failed with HTTP ${response.status}.`,
      response.status === 408 || response.status === 429 || response.status >= 500,
    );
  }
}
