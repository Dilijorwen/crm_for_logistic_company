/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { ChatStorageUploadError } from '../../domain/chat/ChatErrors';
import { ChatAccessService } from '../ChatAccessService';
import { UploadChatAttachments } from '../UploadChatAttachments';
import type { ChatLogger } from '../ports/ChatLogger';
import type { ChatStorage } from '../ports/ChatStorage';
import {
  activeMember,
  attachmentRepository,
  chatMessage,
  chatRecord,
  chatRepository,
  fixedClock,
  memberRepository,
  messageRepository,
  sequentialIds,
  transactionManager,
  userDirectory,
} from './testDoubles';

function silentLogger(): ChatLogger {
  return { warn: () => undefined, error: () => undefined };
}

function createAction(storage: ChatStorage) {
  const chats = chatRepository({
    findById: async () => chatRecord(),
    updateLastMessageAt: async () => undefined,
  });
  const members = memberRepository({
    findMembership: async () => activeMember(),
    isDirectChatAvailable: async () => true,
  });
  return new UploadChatAttachments(
    new ChatAccessService(chats, members),
    chats,
    messageRepository({
      create: async (input) =>
        chatMessage({
          id: input.id,
          text: input.text,
          messageType: input.messageType,
          createdAt: input.createdAt,
        }),
    }),
    attachmentRepository({
      create: async (input) => ({
        id: input.id,
        messageId: input.messageId,
        storageKey: input.storageKey,
        fileName: input.fileName,
        mimeType: input.mimeType,
        size: input.size,
        createdAt: input.createdAt,
      }),
    }),
    userDirectory(),
    storage,
    silentLogger(),
    transactionManager(),
    fixedClock(),
    sequentialIds(),
  );
}

const uploadInput = {
  chatId: '100',
  actorId: '1',
  text: 'Contract',
  files: [
    {
      filePath: '/tmp/contract.pdf',
      originalName: 'contract.pdf',
      declaredMimeType: 'application/pdf',
      detectedMimeType: 'application/pdf',
      size: 1024,
    },
  ],
};

describe('UploadChatAttachments', () => {
  it('promotes a validated temporary object and removes the temporary copy', async () => {
    const operations: string[] = [];
    const storage: ChatStorage = {
      ensureReady: async () => undefined,
      storeTemporary: async ({ key }) => {
        operations.push(`temporary:${key}`);
      },
      promote: async (temporaryKey, finalKey) => {
        operations.push(`promote:${temporaryKey}:${finalKey}`);
      },
      open: async () => undefined,
      delete: async (key) => {
        operations.push(`delete:${key}`);
        return true;
      },
    };

    const result = await createAction(storage).execute(uploadInput);

    expect(result.attachments).toHaveLength(1);
    expect(operations.some((operation) => operation.startsWith('promote:'))).toBe(true);
    expect(operations.some((operation) => operation.startsWith('delete:chats/tmp/'))).toBe(true);
  });

  it('compensates a failed promotion and exposes a typed storage error', async () => {
    const deletedKeys: string[] = [];
    const storage: ChatStorage = {
      ensureReady: async () => undefined,
      storeTemporary: async () => undefined,
      promote: async () => {
        throw new Error('storage unavailable');
      },
      open: async () => undefined,
      delete: async (key) => {
        deletedKeys.push(key);
        return true;
      },
    };

    await expect(createAction(storage).execute(uploadInput)).rejects.toBeInstanceOf(ChatStorageUploadError);
    expect(deletedKeys.some((key) => key.startsWith('chats/tmp/'))).toBe(true);
    expect(deletedKeys.some((key) => key.startsWith('chats/100/'))).toBe(true);
  });
});
