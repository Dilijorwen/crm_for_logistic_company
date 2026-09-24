/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import type { TextHttpRequest, TextHttpResponse, TextHttpTransport } from '../../http/TextHttpTransport';
import { SwisPermitRegistryClient } from '../SwisPermitRegistryClient';
import { SwisResponseParser } from '../SwisResponseParser';

const title = 'ЕАЭС KG 417/043.CN.02.08910';
const declarationTitle = 'ЕАЭС KG417/013.Д.0002575';
const externalId = '7eb3a979-d6da-413f-ab45-b218803003d7';
const searchHtml = `
  <form id="parameters-form"></form>
  <table id="reportTable">
    <tr>
      <th>№</th><th>Регистрационный номер</th><th>Статус сертификата</th><th>Код ТН ВЭД</th>
      <th>Сведения о продукции</th><th>Изготовитель</th><th>Заявитель</th>
      <th>Дата начала действия</th><th>Дата окончания действия</th><th>Показать документ</th>
    </tr>
    <tr>
      <td>1</td><td>${title}</td><td>Действует</td><td>9503009909</td><td>Игрушки</td>
      <td>Изготовитель</td><td>Заявитель</td><td>31 март 2025</td><td>30 март 2030</td>
      <td><a href="/Doc/${externalId}">Показать</a></td>
    </tr>
  </table>`;
const detailHtml = `
  <table><tr>
    <td>Обозначение ТР (НД) с указанием разделов (пунктов, подпунктов)</td>
    <td>&quot;О безопасности игрушек&quot; (ТР ТС 008/2011)</td>
  </tr></table>`;

class FakeTextTransport implements TextHttpTransport {
  readonly requests: TextHttpRequest[] = [];

  constructor(private readonly responses: TextHttpResponse[]) {}

  async request(request: TextHttpRequest): Promise<TextHttpResponse> {
    this.requests.push(request);
    const response = this.responses.shift();
    if (!response) {
      throw new Error('No fake response configured.');
    }
    return response;
  }
}

function response(status: number, body: string): TextHttpResponse {
  return { status, body, headers: { 'content-type': 'text/html; charset=utf-8' } };
}

describe('SwisPermitRegistryClient', () => {
  it('loads basic fields from search HTML and technical regulations from the detail HTML', async () => {
    const transport = new FakeTextTransport([response(200, searchHtml), response(200, detailHtml)]);
    const client = new SwisPermitRegistryClient(transport, new SwisResponseParser(), 'https://swis.test');

    await expect(client.findByTitle('certificate_of_conformity', title)).resolves.toMatchObject({
      externalId,
      documentName: title,
      documentType: 'certificate_of_conformity',
      validFrom: '2025-03-31',
      validUntil: '2030-03-30',
      productInformation: 'Игрушки',
      technicalRegulations: [{ source: 'EAEU', docNum: 'ТР ТС 008/2011', name: 'О безопасности игрушек' }],
    });
    expect(transport.requests).toHaveLength(2);
    expect(transport.requests[0].url).toContain('/Registry/CertificateOfConformity?');
    expect(transport.requests[1].url).toBe(`https://swis.test/Doc/${externalId}`);
  });

  it('checks status with one search request and does not load the detail page', async () => {
    const transport = new FakeTextTransport([response(200, searchHtml)]);
    const client = new SwisPermitRegistryClient(transport, new SwisResponseParser(), 'https://swis.test');

    await expect(client.findStatusByTitle('certificate_of_conformity', title)).resolves.toMatchObject({
      externalId,
      status: 'valid',
    });
    expect(transport.requests).toHaveLength(1);
  });

  it('rejects a changed UUID during a full refresh', async () => {
    const transport = new FakeTextTransport([response(200, searchHtml)]);
    const client = new SwisPermitRegistryClient(transport, new SwisResponseParser(), 'https://swis.test');

    await expect(
      client.getByExternalId('certificate_of_conformity', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', title),
    ).rejects.toMatchObject({ code: 'INVALID_REGISTRY_RESPONSE' });
    expect(transport.requests).toHaveLength(1);
  });

  it('uses the declaration endpoint and returns the declaration document type', async () => {
    const declarationSearchHtml = searchHtml
      .replaceAll(title, declarationTitle)
      .replace('Статус сертификата', 'Статус декларации')
      .replace('Дата начала действия', 'Дата регистрации');
    const transport = new FakeTextTransport([response(200, declarationSearchHtml), response(200, detailHtml)]);
    const client = new SwisPermitRegistryClient(transport, new SwisResponseParser(), 'https://swis.test');

    await expect(client.findByTitle('declaration_of_conformity', declarationTitle)).resolves.toMatchObject({
      documentType: 'declaration_of_conformity',
      documentName: declarationTitle,
    });
    expect(transport.requests[0].url).toContain('/Registry/DeclarationOfConformity?');
    expect(transport.requests[1].url).toBe(`https://swis.test/Doc/${externalId}`);
  });
});
