/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type PluginFileStorage from '@log-company/plugin-file-storage';
import type { Transaction } from '@nocobase/database';
import type { DocumentStorage } from '../../../application/ports/DocumentStorage';
import type { TransactionContext } from '../../../application/ports/ProcessDocumentsRepository';

const areaName = 'process-documents';

export class MinioDocumentStorage implements DocumentStorage {
  constructor(private readonly files: PluginFileStorage) {}

  store(input: Parameters<DocumentStorage['store']>[0]) {
    return this.files.storage.area(areaName).store(input);
  }

  open(key: string) {
    return this.files.storage.area(areaName).open(key);
  }

  listKeys(prefix: string) {
    return this.files.storage.area(areaName).listKeys(prefix);
  }

  async delete(key: string): Promise<boolean> {
    await this.files.deletionQueue.enqueue(areaName, [key], { currentOnly: true });
    return true;
  }

  enqueueDeletion(keys: readonly string[], transaction?: TransactionContext): Promise<void> {
    return this.files.deletionQueue.enqueue(areaName, keys, { transaction: transaction as Transaction | undefined });
  }
}
