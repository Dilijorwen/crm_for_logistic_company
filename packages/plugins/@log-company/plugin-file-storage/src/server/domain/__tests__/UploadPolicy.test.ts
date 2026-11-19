/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { processDocumentUpload, validateUploadBatch, validateUploadName, validateUploadSample } from '../UploadPolicy';

describe('shared upload policy', () => {
  it('preserves nested document names while rejecting traversal and absolute paths', () => {
    expect(validateUploadName('Учредительные/2026/договор.pdf', processDocumentUpload)).toBe('договор.pdf');
    for (const name of ['../secret.pdf', '/secret.pdf', 'C:\\secret.pdf', 'folder//file.pdf', 'file\0.pdf']) {
      expect(() => validateUploadName(name, processDocumentUpload)).toThrow();
    }
  });

  it('requires content matching the extension and keeps BOM-marked XML compatible', () => {
    expect(validateUploadSample('invoice.pdf', '255044462d', false)).toBe('application/pdf');
    expect(validateUploadSample('invoice.xml', 'fffe3c00', true)).toBe('application/xml');
    expect(() => validateUploadSample('invoice.pdf', '504b0304', false)).toThrow();
    expect(() => validateUploadSample('invoice.exe', '', false)).toThrow();
  });

  it('rejects oversized requests even when each file is within the individual limit', () => {
    const files = Array.from({ length: 6 }, () => ({ size: processDocumentUpload.maxFileBytes }));
    expect(() => validateUploadBatch(files, processDocumentUpload)).toThrow('250 МБ');
  });
});
