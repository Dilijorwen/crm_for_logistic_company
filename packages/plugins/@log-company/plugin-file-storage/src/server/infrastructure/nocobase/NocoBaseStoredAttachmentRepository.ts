/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database } from '@nocobase/database';
import type { StoredAttachment, StoredAttachmentRepository } from '../../application/ports/StoredAttachmentAccess';
import { UNIFIED_STORAGE_NAME } from './PrivateMinioStorageType';

export class NocoBaseStoredAttachmentRepository implements StoredAttachmentRepository {
  constructor(private readonly database: Database) {}

  async find(id: string): Promise<StoredAttachment | null> {
    const record = await this.database.getRepository('attachments').findOne({ filterByTk: id, appends: ['storage'] });
    if (!record || record.get('storage')?.get('name') !== UNIFIED_STORAGE_NAME) return null;
    const filename = String(record.get('filename') || '');
    return {
      key: [record.get('path'), filename].filter(Boolean).join('/'),
      fileName: String(record.get('title') || filename) + String(record.get('extname') || ''),
      mimeType: String(record.get('mimetype') || 'application/octet-stream'),
    };
  }
}
