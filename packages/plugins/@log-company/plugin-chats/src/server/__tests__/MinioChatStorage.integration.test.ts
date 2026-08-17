/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MinioChatStorage } from '../infrastructure/storage/minio/MinioChatStorage';

const runMinioIntegration = process.env.CHAT_MINIO_INTEGRATION === '1';

function isAsyncIterable(value: unknown): value is AsyncIterable<Uint8Array> {
  return value !== null && typeof value === 'object' && Symbol.asyncIterator in value;
}

describe.runIf(runMinioIntegration)('MinioChatStorage', () => {
  let directory: string;
  let storage: MinioChatStorage;

  beforeAll(async () => {
    const accessKey = process.env.CHAT_MINIO_ACCESS_KEY;
    const secretKey = process.env.CHAT_MINIO_SECRET_KEY;
    if (!accessKey || !secretKey) {
      throw new Error('CHAT_MINIO_ACCESS_KEY and CHAT_MINIO_SECRET_KEY are required for MinIO integration tests.');
    }
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-minio-test-'));
    storage = new MinioChatStorage({
      endpoint: process.env.CHAT_MINIO_ENDPOINT || 'http://minio:9000',
      region: process.env.CHAT_MINIO_REGION || 'us-east-1',
      accessKey,
      secretKey,
      bucket: process.env.CHAT_MINIO_TEST_BUCKET || 'log-company-chats-test',
    });
    await storage.ensureReady();
  });

  afterAll(async () => {
    if (directory) {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it('uploads, promotes, downloads, and deletes a chat attachment', async () => {
    const content = Buffer.from('chat attachment integration test', 'utf8');
    const filePath = path.join(directory, 'attachment.txt');
    const token = `${Date.now()}-${process.pid}`;
    const temporaryKey = `integration/tmp/${token}.txt`;
    const finalKey = `integration/final/${token}.txt`;
    await fs.writeFile(filePath, content);

    try {
      await storage.storeTemporary({
        key: temporaryKey,
        filePath,
        size: content.length,
        contentType: 'text/plain',
      });
      await storage.promote(temporaryKey, finalKey);
      const opened = await storage.open(finalKey);
      if (!isAsyncIterable(opened)) {
        throw new Error('MinIO response is not readable.');
      }
      const chunks: Buffer[] = [];
      for await (const chunk of opened) {
        chunks.push(Buffer.from(chunk));
      }
      expect(Buffer.concat(chunks).toString('utf8')).toBe(content.toString('utf8'));
    } finally {
      await storage.delete(temporaryKey);
      await storage.delete(finalKey);
    }
  });
});
