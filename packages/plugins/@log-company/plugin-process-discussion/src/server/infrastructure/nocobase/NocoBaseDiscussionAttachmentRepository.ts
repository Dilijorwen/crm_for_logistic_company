/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Model, Transaction } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { PROCESS_DISCUSSION_ATTACHMENT_PURPOSE_FIELD } from '../../../shared/processDiscussionAttachments';
import type {
  DiscussionAttachmentRecord,
  DiscussionAttachmentRepository,
  DiscussionAttachmentTransaction,
} from '../../application/ports/DiscussionAttachmentRepository';

const ATTACHMENTS_COLLECTION = 'attachments';
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

interface AttachmentReferenceLocation {
  collectionName: string;
  referenceField: string;
}

export class NocoBaseDiscussionAttachmentRepository implements DiscussionAttachmentRepository {
  constructor(private readonly plugin: Plugin) {}

  async withTransaction<T>(work: (transaction: DiscussionAttachmentTransaction) => Promise<T>): Promise<T> {
    return this.plugin.db.sequelize.transaction((transaction) =>
      work(transaction as unknown as DiscussionAttachmentTransaction),
    );
  }

  async findById(
    attachmentId: string,
    transaction: DiscussionAttachmentTransaction,
  ): Promise<DiscussionAttachmentRecord | null> {
    const databaseTransaction = this.asTransaction(transaction);
    const model = (await this.plugin.db.getRepository(ATTACHMENTS_COLLECTION).findOne({
      filterByTk: attachmentId,
      transaction: databaseTransaction,
      lock: databaseTransaction.LOCK.UPDATE,
    })) as Model | null;
    if (!model) {
      return null;
    }
    const metadata = this.asRecord(model.get('meta'));
    return {
      id: String(model.get('id')),
      createdById: this.optionalIdentifier(model.get('createdById')),
      purpose:
        typeof metadata[PROCESS_DISCUSSION_ATTACHMENT_PURPOSE_FIELD] === 'string'
          ? String(metadata[PROCESS_DISCUSSION_ATTACHMENT_PURPOSE_FIELD])
          : null,
    };
  }

  async isReferenced(attachmentId: string, transaction: DiscussionAttachmentTransaction): Promise<boolean> {
    const locations = this.referenceLocations();
    for (const location of locations) {
      const collection = this.plugin.db.getCollection(location.collectionName);
      if (!collection) {
        throw new Error(`Attachment reference collection is unavailable: ${location.collectionName}`);
      }
      const referenceCount = await collection.model.count({
        where: { [location.referenceField]: attachmentId },
        paranoid: false,
        transaction: this.asTransaction(transaction),
      });
      if (referenceCount > 0) {
        return true;
      }
    }
    return false;
  }

  async deleteById(attachmentId: string, transaction: DiscussionAttachmentTransaction): Promise<void> {
    await this.plugin.db.getRepository(ATTACHMENTS_COLLECTION).destroy({
      filterByTk: attachmentId,
      transaction: this.asTransaction(transaction),
    });
  }

  private referenceLocations(): AttachmentReferenceLocation[] {
    const locations = new Map<string, AttachmentReferenceLocation>();
    for (const collection of this.plugin.db.collections.values()) {
      for (const field of collection.getFields()) {
        if (field.options?.target !== ATTACHMENTS_COLLECTION) {
          continue;
        }

        let location: AttachmentReferenceLocation | null = null;
        if (field.type === 'belongsTo') {
          location = {
            collectionName: this.requiredIdentifier(collection.name),
            referenceField: this.requiredIdentifier(field.options.foreignKey),
          };
        } else if (field.type === 'belongsToMany') {
          location = {
            collectionName: this.requiredIdentifier(field.options.through),
            referenceField: this.requiredIdentifier(field.options.otherKey),
          };
        }

        if (location) {
          locations.set(`${location.collectionName}.${location.referenceField}`, location);
        }
      }
    }
    return [...locations.values()];
  }

  private requiredIdentifier(value: unknown): string {
    if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) {
      throw new Error('Attachment relation metadata is invalid');
    }
    return value;
  }

  private optionalIdentifier(value: unknown): string | null {
    return value === null || value === undefined || value === '' ? null : String(value);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private asTransaction(transaction: DiscussionAttachmentTransaction): Transaction {
    return transaction as unknown as Transaction;
  }
}
