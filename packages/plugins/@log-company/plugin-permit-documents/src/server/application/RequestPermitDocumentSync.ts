/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { PermitDocumentRepository } from './ports/PermitDocumentRepository';
import type { PermitDocumentSyncQueue } from './ports/PermitDocumentSyncQueue';

export class RequestPermitDocumentSync {
  constructor(
    private readonly repository: PermitDocumentRepository,
    private readonly queue: PermitDocumentSyncQueue,
  ) {}

  async execute(documentId: string): Promise<boolean> {
    const exists = await this.repository.markPending(documentId);
    if (!exists) {
      return false;
    }
    await this.queue.enqueue(documentId);
    return true;
  }
}
