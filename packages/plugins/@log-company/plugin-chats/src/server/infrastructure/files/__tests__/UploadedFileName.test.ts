/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { decodeUploadedFileName } from '../UploadedFileName';

describe('decodeUploadedFileName', () => {
  it.each(['2022-11-25 ТВ Л4.pdf', 'Документы № 1.pdf', '中文合同.pdf', 'Фотография 📷.png', 'résumé.pdf'])(
    'restores a UTF-8 multipart filename: %s',
    (name) => {
      const multipartName = Buffer.from(name, 'utf8').toString('latin1');
      expect(decodeUploadedFileName(multipartName)).toBe(name);
    },
  );

  it.each([
    '2022-11-25 ТВ Л4.pdf',
    '中文合同.pdf',
    'Фотография 📷.png',
    'résumé.pdf',
    'report.pdf',
    '',
    'invalid-\u00ff.pdf',
  ])('preserves an already decoded or non-UTF-8 filename: %s', (name) => {
    expect(decodeUploadedFileName(name)).toBe(name);
  });

  it('does not decode a Cyrillic filename twice', () => {
    const name = '2022-11-25 ТВ Л4.pdf';
    const decoded = decodeUploadedFileName(Buffer.from(name, 'utf8').toString('latin1'));
    expect(decodeUploadedFileName(decoded)).toBe(name);
  });
});
