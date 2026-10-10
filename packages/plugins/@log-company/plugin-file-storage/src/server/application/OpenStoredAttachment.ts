/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type {
  AttachmentObjectStorage,
  FileLinkVerifier,
  StoredAttachmentRepository,
} from './ports/StoredAttachmentAccess';

export class InvalidFileLinkError extends Error {}
export class StoredAttachmentNotFoundError extends Error {}

export class OpenStoredAttachment {
  constructor(
    private readonly attachments: StoredAttachmentRepository,
    private readonly links: FileLinkVerifier,
    private readonly storage: AttachmentObjectStorage,
  ) {}

  async execute(input: { id: unknown; expires: unknown; signature: unknown }) {
    const id = typeof input.id === 'string' || typeof input.id === 'number' ? String(input.id) : '';
    if (!/^\d+$/.test(id) || !this.links.verify(id, input.expires, input.signature)) {
      throw new InvalidFileLinkError();
    }
    const attachment = await this.attachments.find(id);
    if (!attachment) throw new StoredAttachmentNotFoundError();
    return { ...attachment, stream: await this.storage.open(attachment.key) };
  }
}
