/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { MinioStorageArea, readFileStorageConfig, type FileStorageConfig } from '@log-company/plugin-file-storage';
import type { ChatStorage, StoreChatObjectInput } from '../../../application/ports/ChatStorage';

export type MinioChatConfig = FileStorageConfig;
export const readChatMinioConfig = readFileStorageConfig;

export class MinioChatStorage extends MinioStorageArea implements ChatStorage {
  constructor(config: MinioChatConfig) {
    super(config, 'chat-attachments');
  }

  storeTemporary(input: StoreChatObjectInput): Promise<void> {
    return this.store(input);
  }
}
