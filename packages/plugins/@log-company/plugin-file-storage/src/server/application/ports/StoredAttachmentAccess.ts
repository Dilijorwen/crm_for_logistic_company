/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Readable } from 'stream';

export interface StoredAttachment {
  key: string;
  fileName: string;
  mimeType: string;
}

export interface StoredAttachmentRepository {
  find(id: string): Promise<StoredAttachment | null>;
}

export interface FileLinkVerifier {
  verify(id: string, expires: unknown, signature: unknown): boolean;
}

export interface AttachmentObjectStorage {
  open(key: string): Promise<Readable>;
}
