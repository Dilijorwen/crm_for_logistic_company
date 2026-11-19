/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { strFromU8, unzipSync } from 'fflate';

const mediaTypes: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  webm: 'video/webm',
};
const spreadsheetFormats = new Set(['xls', 'xlsx', 'ods', 'csv']);
const officeFormats = new Set(['docx', 'pptx', 'odt']);
const textFormats = new Set(['txt', 'log', 'xml', 'json', 'md', 'rtf', 'html', 'svg']);
const maxOfficeBytes = 20 * 1024 * 1024;
const maxUnpackedBytes = 64 * 1024 * 1024;
const maxTextBytes = 128 * 1024;
const maxRows = 500;
const maxColumns = 64;

export type PreviewContent =
  | { kind: 'media'; mime: string; blob: Blob }
  | { kind: 'text'; text: string; limited?: boolean }
  | { kind: 'table'; sheets: { name: string; rows: string[][]; limited: boolean }[] }
  | { kind: 'unsupported' };

function fileExtension(name: string): string {
  return /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? '';
}

export function canPreviewDocument(name: string): boolean {
  const extension = fileExtension(name);
  return (
    Object.prototype.hasOwnProperty.call(mediaTypes, extension) ||
    spreadsheetFormats.has(extension) ||
    officeFormats.has(extension) ||
    textFormats.has(extension) ||
    extension === 'zip'
  );
}

export async function readDocumentPreview(name: string, blob: Blob): Promise<PreviewContent> {
  const extension = fileExtension(name);
  const mime = Object.prototype.hasOwnProperty.call(mediaTypes, extension) ? mediaTypes[extension] : undefined;
  if (mime) {
    if (extension === 'pdf' && !(await blob.slice(0, 5).text()).startsWith('%PDF-')) {
      throw new Error('Неверный формат PDF.');
    }
    return { kind: 'media', mime, blob: new Blob([blob], { type: mime }) };
  }
  if (textFormats.has(extension)) {
    return { kind: 'text', text: await blob.slice(0, maxTextBytes).text(), limited: blob.size > maxTextBytes };
  }
  if (!canPreviewDocument(name)) return { kind: 'unsupported' };
  if (blob.size > maxOfficeBytes) throw new Error('Файл слишком большой для предпросмотра.');
  const data = new Uint8Array(await blob.arrayBuffer());
  const isZip = data[0] === 0x50 && data[1] === 0x4b;
  if (isZip) {
    let archiveBytes = 0;
    const entries: string[] = [];
    const files = unzipSync(data, {
      filter: ({ name: entry, originalSize }) => {
        if (extension === 'zip') {
          if (entries.length <= maxRows) entries.push(entry);
          return false;
        }
        archiveBytes += originalSize;
        if (archiveBytes > maxUnpackedBytes) throw new Error('Файл слишком большой для предпросмотра.');
        return officeFormats.has(extension) && /^(word\/document|content|ppt\/slides\/slide\d+)\.xml$/.test(entry);
      },
    });
    if (extension === 'zip') {
      return { kind: 'text', text: entries.slice(0, maxRows).join('\n'), limited: entries.length > maxRows };
    }
    if (officeFormats.has(extension) && Object.keys(files).length) {
      const text = Object.keys(files)
        .sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }))
        .map((entry) => {
          const xml = new DOMParser().parseFromString(strFromU8(files[entry]), 'application/xml');
          return Array.from(xml.getElementsByTagNameNS('*', 'p'), (p) => p.textContent?.trim())
            .filter(Boolean)
            .join('\n');
        })
        .join('\n\n');
      return { kind: 'text', text: text.slice(0, maxTextBytes), limited: text.length > maxTextBytes };
    }
  }
  if (!spreadsheetFormats.has(extension)) return { kind: 'unsupported' };
  const { read, utils } = await import('xlsx');
  const workbook = read(data, { type: 'array', sheetRows: maxRows + 1, cellHTML: false, cellFormula: false });
  return {
    kind: 'table',
    sheets: workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet['!ref']) return { name: sheetName, rows: [], limited: false };
      const { s: start, e: end } = utils.decode_range(sheet['!ref']);
      const rowCount = Math.min(maxRows, end.r - start.r + 1);
      const columnCount = Math.min(maxColumns, end.c - start.c + 1);
      return {
        name: sheetName,
        limited: end.r - start.r + 1 > maxRows || end.c - start.c + 1 > maxColumns,
        rows: Array.from({ length: rowCount }, (_, row) =>
          Array.from({ length: columnCount }, (_, col) => {
            const cell = sheet[utils.encode_cell({ r: start.r + row, c: start.c + col })];
            return cell ? utils.format_cell(cell).slice(0, 500) : '';
          }),
        ),
      };
    }),
  };
}
