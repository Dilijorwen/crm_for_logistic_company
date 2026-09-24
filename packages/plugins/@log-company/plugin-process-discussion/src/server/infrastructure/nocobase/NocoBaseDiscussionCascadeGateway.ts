/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import type { DiscussionCascadeGateway } from '../../application/ports/DiscussionCascadeGateway';

const PROCESS_COLLECTION = 'shipments';
const COMMENTS_COLLECTION = 'shipment_comments';
const PROCESS_COMMENTS_FIELD = 'comments';
const COMMENT_PROCESS_FIELD = 'shipment';
const COMMENT_PROCESS_FOREIGN_KEY = 'shipment_id';

export class NocoBaseDiscussionCascadeGateway implements DiscussionCascadeGateway {
  constructor(private readonly plugin: Plugin) {}

  registerRuntimeCascade(): void {
    const references = this.plugin.db.referenceMap.getReferences(PROCESS_COLLECTION) || [];
    const existingReference = references.find(
      (reference) =>
        reference.sourceCollectionName === COMMENTS_COLLECTION &&
        reference.sourceField === COMMENT_PROCESS_FOREIGN_KEY &&
        reference.targetField === 'id' &&
        reference.targetCollectionName === PROCESS_COLLECTION,
    );

    if (existingReference) {
      existingReference.onDelete = 'CASCADE';
      existingReference.priority = 'user';
    }

    this.plugin.db.referenceMap.addReference({
      sourceCollectionName: COMMENTS_COLLECTION,
      sourceField: COMMENT_PROCESS_FOREIGN_KEY,
      targetField: 'id',
      targetCollectionName: PROCESS_COLLECTION,
      onDelete: 'CASCADE',
      priority: 'user',
    });

    const processCommentsField = this.plugin.db.getCollection(PROCESS_COLLECTION)?.getField(PROCESS_COMMENTS_FIELD);
    const commentProcessField = this.plugin.db.getCollection(COMMENTS_COLLECTION)?.getField(COMMENT_PROCESS_FIELD);

    if (processCommentsField?.options) {
      processCommentsField.options.onDelete = 'CASCADE';
    }
    if (commentProcessField?.options) {
      commentProcessField.options.onDelete = 'CASCADE';
    }
  }
}
