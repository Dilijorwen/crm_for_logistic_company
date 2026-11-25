/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Buffer } from 'node:buffer';
import { MAX_DOCUMENT_UPLOAD_ENTRIES } from '../../../contracts/processDocuments';
import { ProcessDocumentsError } from '../../domain/documents/DocumentErrors';

function hasMojibake(value: string): boolean {
  return /[ÃÂÐÑâ][\u0080-\u00ff]/.test(value);
}

export function decodeUploadedName(rawName: string): string {
  const value = String(rawName || '');
  if (!value || !hasMojibake(value)) {
    return value;
  }

  const decoded = Buffer.from(value, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? value : decoded;
}

export function parseUploadedEmptyFolders(value: unknown): string[] | undefined {
  if (value === undefined) return;
  if (typeof value === 'string') {
    let paths: unknown;
    try {
      paths = JSON.parse(value);
    } catch {
      throw new ProcessDocumentsError('INVALID_UPLOAD', 'Неверный список пустых папок.');
    }
    if (
      Array.isArray(paths) &&
      paths.length <= MAX_DOCUMENT_UPLOAD_ENTRIES &&
      paths.every((path) => typeof path === 'string')
    )
      return paths;
  }
  throw new ProcessDocumentsError('INVALID_UPLOAD', 'Неверный список пустых папок.');
}
