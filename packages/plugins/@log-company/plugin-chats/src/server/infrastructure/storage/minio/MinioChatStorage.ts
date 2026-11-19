/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { FileStorageArea } from '@log-company/plugin-file-storage';
import type { ChatStorage, StoreChatObjectInput } from '../../../application/ports/ChatStorage';

export class MinioChatStorage implements ChatStorage {
  constructor(
    private readonly area: FileStorageArea,
    private readonly discard: (key: string) => Promise<void>,
  ) {}

  storeTemporary(input: StoreChatObjectInput): Promise<void> {
    return this.area.store(input);
  }

  open(key: string) {
    return this.area.open(key);
  }

  promote(source: string, target: string) {
    return this.area.promote(source, target);
  }

  async delete(key: string) {
    await this.discard(key);
    return true;
  }
}
