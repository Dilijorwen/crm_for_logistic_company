/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { SwisResponseParser } from '../SwisResponseParser';

const title = 'ЕАЭС KG 417/043.CN.02.08910';
const declarationTitle = 'ЕАЭС KG417/013.Д.0002575';

function searchHtml(status = 'Действует'): string {
  return `
    <form id="parameters-form"></form>
    <table id="reportTable">
      <tr>
        <th>№</th>
        <th>Регистрационный номер</th>
        <th>Статус сертификата</th>
        <th>Код ТН ВЭД</th>
        <th>Сведения о продукции</th>
        <th>Изготовитель</th>
        <th>Заявитель</th>
        <th>Дата начала действия</th>
        <th>Дата окончания действия</th>
        <th>Показать документ</th>
      </tr>
      <tr>
        <td>1</td>
        <td>${title}</td>
        <td>${status}</td>
        <td>9503009909</td>
        <td>&#171;Панда&#187;; Игрушки - предметы игрового обихода</td>
        <td>Изготовитель</td>
        <td>Заявитель</td>
        <td>31 март 2025</td>
        <td>30 март 2030</td>
        <td><a href="/Doc/7eb3a979-d6da-413f-ab45-b218803003d7">Показать</a></td>
      </tr>
    </table>`;
}

describe('SwisResponseParser', () => {
  it('parses the exact certificate row, Russian dates, entities and document UUID', () => {
    expect(new SwisResponseParser().parseSearch(searchHtml(), title, 'certificate_of_conformity')).toEqual({
      externalId: '7eb3a979-d6da-413f-ab45-b218803003d7',
      externalStatus: 'Действует',
      documentName: title,
      validFrom: '2025-03-31',
      validUntil: '2030-03-30',
      status: 'valid',
      productInformation: '«Панда»; Игрушки - предметы игрового обихода',
    });
  });

  it('parses a declaration with declaration-specific headers', () => {
    const html = `
      <form id="parameters-form"></form>
      <table id="reportTable">
        <tr>
          <th>№</th><th>Регистрационный номер</th><th>Статус декларации</th><th>Код ТН ВЭД</th>
          <th>Сведения о продукции</th><th>Изготовитель</th><th>Заявитель</th>
          <th>Дата регистрации</th><th>Дата окончания действия</th><th>Показать документ</th>
        </tr>
        <tr>
          <td>1</td><td>${declarationTitle}</td><td>Действует</td><td>6104690009</td>
          <td>Брюки для женщин; блузоны</td><td>Изготовитель</td><td>Заявитель</td>
          <td>19 февраль 2026</td><td>18 февраль 2029</td>
          <td><a href="/Doc/e37af2ee-554e-4c19-a898-1c8a8e2bc580">Показать</a></td>
        </tr>
      </table>`;

    expect(new SwisResponseParser().parseSearch(html, declarationTitle, 'declaration_of_conformity')).toEqual({
      externalId: 'e37af2ee-554e-4c19-a898-1c8a8e2bc580',
      externalStatus: 'Действует',
      documentName: declarationTitle,
      validFrom: '2026-02-19',
      validUntil: '2029-02-18',
      status: 'valid',
      productInformation: 'Брюки для женщин; блузоны',
    });
  });

  it('returns null for a valid empty search page and rejects an unexpected page', () => {
    const parser = new SwisResponseParser();
    expect(
      parser.parseSearch('<form method="get" id="parameters-form"></form>', title, 'certificate_of_conformity'),
    ).toBeNull();
    expect(() =>
      parser.parseSearch('<html><title>Service unavailable</title></html>', title, 'certificate_of_conformity'),
    ).toThrow('does not contain the registry form');
  });

  it('rejects an unknown status instead of guessing', () => {
    expect(() =>
      new SwisResponseParser().parseSearch(searchHtml('Новый статус'), title, 'certificate_of_conformity'),
    ).toThrow('unsupported document status');
  });

  it('extracts technical regulations only from the detail field', () => {
    const html = `
      <table>
        <tr><td>Сведения о продукции</td><td>Товар 1</td></tr>
        <tr>
          <td>Обозначение ТР (НД) с указанием разделов (пунктов, подпунктов)</td>
          <td>Технического регламента Таможенного союза &quot;О безопасности игрушек&quot; (ТР ТС 008/2011)</td>
        </tr>
      </table>`;
    expect(new SwisResponseParser().parseTechnicalRegulations(html)).toEqual([
      { source: 'EAEU', docNum: 'ТР ТС 008/2011', name: 'О безопасности игрушек' },
    ]);
  });
});
