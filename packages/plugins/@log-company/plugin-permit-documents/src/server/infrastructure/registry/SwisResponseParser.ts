/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Parser } from 'htmlparser2';
import {
  InvalidRegistryDocumentError,
  mapSwisStatus,
  type EaeuTechnicalRegulationReference,
} from '../../domain/permit-document/RegistryDocument';
import { parseEaeuTechnicalRegulations } from '../../domain/permit-document/TechnicalRegulationParser';

interface HtmlCell {
  kind: 'td' | 'th';
  text: string;
  links: string[];
}

interface HtmlRow {
  cells: HtmlCell[];
}

interface HtmlRowsResult {
  tableFound: boolean;
  rows: HtmlRow[];
}

export interface SwisRegistrySummary {
  externalId: string;
  externalStatus: string;
  documentName: string;
  validFrom: string;
  validUntil: string | null;
  status: 'valid' | 'suspended' | 'terminated';
  productInformation: string;
}

export type SwisPermitDocumentType = 'declaration_of_conformity' | 'certificate_of_conformity';

interface SearchColumnNames {
  status: string;
  validFrom: string;
}

const UUID_PATH_PATTERN = /^\/Doc\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/iu;
const SEARCH_FORM_PATTERN = /<form\b[^>]*\bid=["']parameters-form["']/iu;
const SEARCH_COLUMN_NAMES: Record<SwisPermitDocumentType, SearchColumnNames> = {
  declaration_of_conformity: {
    status: 'статус декларации',
    validFrom: 'дата регистрации',
  },
  certificate_of_conformity: {
    status: 'статус сертификата',
    validFrom: 'дата начала действия',
  },
};
const MONTH_NUMBERS: Record<string, string> = {
  январ: '01',
  феврал: '02',
  март: '03',
  апрел: '04',
  май: '05',
  мая: '05',
  июн: '06',
  июл: '07',
  август: '08',
  сентябр: '09',
  октябр: '10',
  ноябр: '11',
  декабр: '12',
};

export class SwisResponseParser {
  parseSearch(html: string, title: string, documentType: SwisPermitDocumentType): SwisRegistrySummary | null {
    const result = this.readRows(html, 'reportTable');
    if (!result.tableFound) {
      if (SEARCH_FORM_PATTERN.test(html)) {
        return null;
      }
      throw new InvalidRegistryDocumentError('SWIS search response does not contain the registry form.');
    }
    const headerRow = result.rows.find((row) => row.cells.some((cell) => cell.kind === 'th'));
    if (!headerRow) {
      throw new InvalidRegistryDocumentError('SWIS search table has no header row.');
    }
    const columns = new Map(
      headerRow.cells.map((cell, index) => [this.normalizeText(cell.text).toLocaleLowerCase('ru-RU'), index]),
    );
    const searchColumnNames = SEARCH_COLUMN_NAMES[documentType];
    const documentNameIndex = this.requiredColumn(columns, 'регистрационный номер');
    const statusIndex = this.requiredColumn(columns, searchColumnNames.status);
    const productIndex = this.requiredColumn(columns, 'сведения о продукции');
    const validFromIndex = this.requiredColumn(columns, searchColumnNames.validFrom);
    const validUntilIndex = this.requiredColumn(columns, 'дата окончания действия');
    const documentLinkIndex = this.requiredColumn(columns, 'показать документ');
    const row = result.rows.find(
      (candidate) =>
        candidate.cells.every((cell) => cell.kind === 'td') &&
        this.normalizeText(candidate.cells[documentNameIndex]?.text || '') === this.normalizeText(title),
    );
    if (!row) {
      return null;
    }
    const externalStatus = this.cellText(row, statusIndex, 'status');
    const status = mapSwisStatus(externalStatus);
    if (status === null) {
      throw new InvalidRegistryDocumentError('SWIS returned an unsupported document status.');
    }
    const documentLink = row.cells[documentLinkIndex]?.links.find((link) => UUID_PATH_PATTERN.test(link));
    const externalId = documentLink ? UUID_PATH_PATTERN.exec(documentLink)?.[1] : null;
    if (!externalId) {
      throw new InvalidRegistryDocumentError('SWIS document UUID is missing.');
    }
    return {
      externalId,
      externalStatus,
      documentName: this.cellText(row, documentNameIndex, 'document number'),
      validFrom: this.parseDate(this.cellText(row, validFromIndex, 'registration date')),
      validUntil: this.parseNullableDate(this.normalizeText(row.cells[validUntilIndex]?.text || '')),
      status,
      productInformation: this.cellText(row, productIndex, 'product information'),
    };
  }

  parseTechnicalRegulations(html: string): EaeuTechnicalRegulationReference[] {
    const result = this.readRows(html);
    const regulationRow = result.rows.find((row) => {
      const label = this.normalizeText(row.cells[0]?.text || '').toLocaleLowerCase('ru-RU');
      return label.startsWith('обозначение тр (нд) с указанием разделов');
    });
    if (!regulationRow || regulationRow.cells.length < 2) {
      throw new InvalidRegistryDocumentError('SWIS document card has no technical regulation field.');
    }
    return parseEaeuTechnicalRegulations([this.normalizeText(regulationRow.cells[1].text)]);
  }

  private readRows(html: string, targetTableId?: string): HtmlRowsResult {
    const rows: HtmlRow[] = [];
    let tableFound = targetTableId === undefined;
    let targetTableDepth = targetTableId === undefined ? 1 : 0;
    let currentRow: HtmlRow | null = null;
    let currentCell: HtmlCell | null = null;
    const isCapturing = (): boolean => targetTableId === undefined || targetTableDepth > 0;
    const parser = new Parser(
      {
        onopentag: (name, attributes) => {
          if (name === 'table' && targetTableId !== undefined) {
            if (targetTableDepth > 0) {
              targetTableDepth += 1;
            } else if (attributes.id === targetTableId) {
              tableFound = true;
              targetTableDepth = 1;
            }
          }
          if (!isCapturing()) {
            return;
          }
          if (name === 'tr') {
            currentRow = { cells: [] };
          } else if ((name === 'td' || name === 'th') && currentRow) {
            currentCell = { kind: name, text: '', links: [] };
          } else if (name === 'a' && currentCell && typeof attributes.href === 'string') {
            currentCell.links.push(attributes.href);
          }
        },
        ontext: (text) => {
          if (isCapturing() && currentCell) {
            currentCell.text += text;
          }
        },
        onclosetag: (name) => {
          if (isCapturing()) {
            if ((name === 'td' || name === 'th') && currentRow && currentCell) {
              currentRow.cells.push({ ...currentCell, text: this.normalizeText(currentCell.text) });
              currentCell = null;
            } else if (name === 'tr' && currentRow) {
              if (currentRow.cells.length > 0) {
                rows.push(currentRow);
              }
              currentRow = null;
            }
          }
          if (name === 'table' && targetTableId !== undefined && targetTableDepth > 0) {
            targetTableDepth -= 1;
          }
        },
      },
      { decodeEntities: true },
    );
    parser.write(html);
    parser.end();
    return { tableFound, rows };
  }

  private requiredColumn(columns: ReadonlyMap<string, number>, name: string): number {
    const index = columns.get(name);
    if (index === undefined) {
      throw new InvalidRegistryDocumentError(`SWIS search table has no ${name} column.`);
    }
    return index;
  }

  private cellText(row: HtmlRow, index: number, field: string): string {
    const value = this.normalizeText(row.cells[index]?.text || '');
    if (!value) {
      throw new InvalidRegistryDocumentError(`SWIS ${field} is missing.`);
    }
    return value;
  }

  private parseNullableDate(value: string): string | null {
    return value.length === 0 || value === '-' ? null : this.parseDate(value);
  }

  private parseDate(value: string): string {
    const numeric = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/u.exec(value);
    if (numeric) {
      return `${numeric[3]}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`;
    }
    const written = /^(\d{1,2})\s+([а-яё]+)\s+(\d{4})$/iu.exec(value);
    if (written) {
      const monthName = written[2].toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
      const month = Object.entries(MONTH_NUMBERS).find(([prefix]) => monthName.startsWith(prefix))?.[1];
      if (month) {
        return `${written[3]}-${month}-${written[1].padStart(2, '0')}`;
      }
    }
    throw new InvalidRegistryDocumentError('SWIS returned an invalid document date.');
  }

  private normalizeText(value: string): string {
    return value
      .replace(/\u00a0/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim();
  }
}
