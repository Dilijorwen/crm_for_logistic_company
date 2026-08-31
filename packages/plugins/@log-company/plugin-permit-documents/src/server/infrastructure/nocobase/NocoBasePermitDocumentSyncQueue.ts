/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import type { PermitDocumentSyncQueue } from '../../application/ports/PermitDocumentSyncQueue';

export const PERMIT_DOCUMENT_SYNC_CHANNEL = '@log-company/plugin-permit-documents.sync';

export interface PermitDocumentSyncMessage {
  documentId: string;
}

export class NocoBasePermitDocumentSyncQueue implements PermitDocumentSyncQueue {
  constructor(private readonly plugin: Plugin) {}

  async enqueue(documentId: string): Promise<void> {
    await this.plugin.app.eventQueue.publish(PERMIT_DOCUMENT_SYNC_CHANNEL, { documentId });
  }
}
