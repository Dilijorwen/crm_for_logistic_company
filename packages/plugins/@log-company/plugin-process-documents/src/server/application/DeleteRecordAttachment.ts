/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ProcessDocumentsError } from '../domain/documents/DocumentErrors';
import type { DocumentActor } from './ports/ProcessDocumentsRepository';

export interface RecordAttachmentTarget {
  collection: string;
  recordId: string;
  field: string;
  attachmentId: string;
}

export interface RecordAttachmentRepository {
  deleteFromRecord(target: RecordAttachmentTarget, actor: DocumentActor): Promise<void>;
}

export class DeleteRecordAttachment {
  constructor(private readonly repository: RecordAttachmentRepository) {}

  execute(input: Record<string, unknown>, actor: DocumentActor): Promise<void> {
    const collection = this.value(input.collection, /^[a-zA-Z_][a-zA-Z0-9_]{0,127}$/);
    const field = this.value(input.field, /^[a-zA-Z_][a-zA-Z0-9_]{0,127}$/);
    const recordId = this.value(input.recordId, /^[\w-]{1,128}$/);
    const attachmentId = this.value(input.attachmentId, /^[1-9][0-9]{0,18}$/);
    if (attachmentId.length === 19 && attachmentId > '9223372036854775807') {
      throw new ProcessDocumentsError('INVALID_DOCUMENT_SCOPE', 'Неверный идентификатор вложения.');
    }
    return this.repository.deleteFromRecord({ collection, field, recordId, attachmentId }, actor);
  }

  private value(value: unknown, format: RegExp): string {
    if (
      (typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value))) &&
      format.test(String(value))
    )
      return String(value);
    throw new ProcessDocumentsError('INVALID_DOCUMENT_SCOPE', 'Неверные параметры вложения.');
  }
}
