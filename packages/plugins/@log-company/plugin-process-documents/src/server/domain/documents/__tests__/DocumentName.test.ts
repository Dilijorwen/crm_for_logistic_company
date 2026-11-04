/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import {
  createUniqueDocumentName,
  safeStorageExtension,
  sanitizeDocumentName,
  splitRelativeDocumentName,
} from '../DocumentName';

describe('DocumentName', () => {
  it('normalizes paths and preserves nested upload folders', () => {
    expect(splitRelativeDocumentName('Договоры/2026/контракт.pdf')).toEqual({
      folders: ['Договоры', '2026'],
      filename: 'контракт.pdf',
    });
    expect(sanitizeDocumentName('../опасный\\файл.txt')).toBe('.._опасный_файл.txt');
  });

  it('creates stable unique names and safe storage extensions', () => {
    expect(createUniqueDocumentName('invoice.pdf', ['invoice.pdf', 'invoice (1).pdf'], true)).toBe('invoice (2).pdf');
    expect(createUniqueDocumentName('Договоры', ['Договоры'], false)).toBe('Договоры (1)');
    expect(safeStorageExtension('archive.TAR.GZ')).toBe('.gz');
    expect(safeStorageExtension('payload.<script>')).toBe('.script');
  });
});
