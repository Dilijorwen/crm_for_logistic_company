/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { decodeUploadedName } from '../UploadedDocumentName';

describe('multipart filename decoding', () => {
  it('repairs UTF-8 names decoded as latin1', () => {
    const mojibake = Buffer.from('Документ.pdf', 'utf8').toString('latin1');
    expect(decodeUploadedName(mojibake)).toBe('Документ.pdf');
  });

  it.each(['Договоры/2026/контракт.pdf', '', 'report.pdf'])('preserves an already decoded filename: %s', (name) => {
    expect(decodeUploadedName(name)).toBe(name);
  });
});
