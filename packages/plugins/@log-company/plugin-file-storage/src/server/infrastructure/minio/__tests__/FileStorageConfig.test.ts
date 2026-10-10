/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { readFileStorageConfig } from '../FileStorageConfig';

describe('FileStorageConfig', () => {
  it('uses a single target bucket and separately remembers legacy sources', () => {
    const config = readFileStorageConfig({ FILE_STORAGE_ACCESS_KEY: 'key', FILE_STORAGE_SECRET_KEY: 'secret' }, 'crm');
    expect(config.bucket).toBe('log-company-files');
    expect(config.application).toBe('crm');
    expect(config.legacy?.['chat-attachments']?.bucket).toBe('log-company-chats');
    expect(config.legacy?.['process-documents']?.bucket).toBe('log-company-process-documents');
  });

  it('prefers the common configuration without changing legacy credentials', () => {
    const config = readFileStorageConfig({
      FILE_STORAGE_ACCESS_KEY: 'new-key',
      FILE_STORAGE_SECRET_KEY: 'new-secret',
      FILE_STORAGE_BUCKET: 'all-files',
      CHAT_MINIO_ACCESS_KEY: 'old-key',
      CHAT_MINIO_SECRET_KEY: 'old-secret',
      CHAT_MINIO_BUCKET: 'old-chat',
    });
    expect(config.accessKey).toBe('new-key');
    expect(config.bucket).toBe('all-files');
    expect(config.legacy?.['chat-attachments']?.accessKey).toBe('old-key');
  });

  it('supports existing installations before environment changes', () => {
    expect(
      readFileStorageConfig({ PROCESS_DOCUMENTS_MINIO_ACCESS_KEY: 'key', PROCESS_DOCUMENTS_MINIO_SECRET_KEY: 'secret' })
        .accessKey,
    ).toBe('key');
  });

  it('fails closed without credentials', () => {
    expect(() => readFileStorageConfig({})).toThrow('FILE_STORAGE_ACCESS_KEY');
  });
});
