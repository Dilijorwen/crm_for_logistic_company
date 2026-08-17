/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export interface DiscussionAttachmentTransaction {
  readonly transactionMarker?: never;
}

export interface DiscussionAttachmentRecord {
  id: string;
  createdById: string | null;
  purpose: string | null;
}

export interface DiscussionAttachmentRepository {
  withTransaction<T>(work: (transaction: DiscussionAttachmentTransaction) => Promise<T>): Promise<T>;
  findById(
    attachmentId: string,
    transaction: DiscussionAttachmentTransaction,
  ): Promise<DiscussionAttachmentRecord | null>;
  isReferenced(attachmentId: string, transaction: DiscussionAttachmentTransaction): Promise<boolean>;
  deleteById(attachmentId: string, transaction: DiscussionAttachmentTransaction): Promise<void>;
}
