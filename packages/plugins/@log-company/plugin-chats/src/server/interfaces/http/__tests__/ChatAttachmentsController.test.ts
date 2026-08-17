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
import type { Context } from '@nocobase/actions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatLogger } from '../../../application/ports/ChatLogger';
import type { FileTypeDetector } from '../../../application/ports/FileTypeDetector';
import { ChatAttachmentsController } from '../ChatAttachmentsController';
import type { ChatActions } from '../ChatActions';
import { ChatHttpSupport } from '../ChatHttpSupport';

interface TestUploadFile {
  path: string;
  originalname: string;
  mimetype: string;
  size: number;
}

type TestUploadContext = Context & { files?: TestUploadFile[] };

describe('ChatAttachmentsController', () => {
  let directory: string;
  let filePath: string;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-attachments-controller-test-'));
    filePath = path.join(directory, 'partial-upload.txt');
    await fs.writeFile(filePath, 'partial upload');
  });

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('removes partially uploaded files when multer rejects the request', async () => {
    const logger: ChatLogger = {
      warn: vi.fn(),
      error: vi.fn(),
    };
    const fileTypes: FileTypeDetector = {
      detect: vi.fn(),
    };
    const controller = new ChatAttachmentsController({} as ChatActions, new ChatHttpSupport(logger), fileTypes, logger);
    Object.defineProperty(controller, 'upload', {
      value: async (context: TestUploadContext): Promise<void> => {
        context.files = [
          {
            path: filePath,
            originalname: 'partial-upload.txt',
            mimetype: 'text/plain',
            size: 14,
          },
        ];
        throw Object.assign(new Error('File too large'), { code: 'LIMIT_FILE_SIZE' });
      },
    });

    const context = {
      action: {
        resourceName: 'chatAttachments',
        actionName: 'upload',
        params: { values: {} },
      },
      query: {},
      request: {},
      state: { currentUser: { id: '1' } },
      t: (key: string) => key,
      throw: (status: number, message: string): never => {
        throw Object.assign(new Error(message), { status });
      },
    } as unknown as TestUploadContext;

    await expect(controller.actions.upload(context, async () => undefined)).rejects.toMatchObject({ status: 413 });
    await expect(fs.stat(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
