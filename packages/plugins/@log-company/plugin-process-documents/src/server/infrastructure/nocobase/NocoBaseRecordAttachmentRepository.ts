/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { checkFilterParams, createUserProvider, parseJsonTemplate } from '@nocobase/acl';
import type { Context } from '@nocobase/actions';
import type {
  Collection,
  Database,
  Filter,
  MultipleRelationRepository,
  SingleRelationRepository,
  Transaction,
} from '@nocobase/database';
import type { AttachmentModel } from '@nocobase/plugin-file-manager/server';
import type { RecordAttachmentRepository, RecordAttachmentTarget } from '../../application/DeleteRecordAttachment';
import type { DocumentActor } from '../../application/ports/ProcessDocumentsRepository';
import { ProcessDocumentsError } from '../../domain/documents/DocumentErrors';

type AttachmentDeletion = { backend: 'minio'; key: string } | { backend: 'local'; remove(): Promise<void> };

interface AttachmentAccessContext extends Context {
  can?: (input: { resource: string; action: string }) => {
    params?: { filter?: Filter; whitelist?: string[]; blacklist?: string[] };
  } | null;
}

export class NocoBaseRecordAttachmentRepository implements RecordAttachmentRepository {
  constructor(
    private readonly database: Database,
    private readonly deletionFor: (record: AttachmentModel) => AttachmentDeletion,
    private readonly enqueue: (
      area: 'attachments',
      keys: string[],
      options: { transaction: Transaction },
    ) => Promise<void>,
  ) {}

  async deleteFromRecord(target: RecordAttachmentTarget, actor: DocumentActor): Promise<void> {
    const owner = this.database.getCollection(target.collection);
    const field = owner?.getField(target.field);
    const attachments = this.database.getCollection('attachments');
    if (
      !field ||
      field.options.interface !== 'attachment' ||
      field.options.target !== attachments.name ||
      field.options.readonly ||
      !['belongsTo', 'belongsToMany', 'hasMany', 'hasOne'].includes(field.type) ||
      typeof owner.filterTargetKey !== 'string'
    )
      throw new ProcessDocumentsError('INVALID_DOCUMENT_SCOPE', 'Поле не поддерживает удаление вложений.');

    const permissions = await Promise.all([
      this.accessFilter(owner, 'get', actor, target.field),
      this.accessFilter(owner, 'update', actor, target.field),
      this.accessFilter(attachments, 'destroy', actor),
    ]);
    const ownerKey = owner.filterTargetKey;
    const ownerKeyType = owner.getField(ownerKey)?.type;
    if (['id', 'integer', 'bigInt'].includes(ownerKeyType) && !/^-?[0-9]{1,18}$/.test(target.recordId)) {
      throw new ProcessDocumentsError('INVALID_DOCUMENT_SCOPE', 'Неверный идентификатор карточки.');
    }
    const deletion = await this.database.sequelize.transaction(async (transaction) => {
      if (field.type === 'belongsTo') {
        await owner.model.findOne({
          where: { [ownerKey]: target.recordId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
      }
      const related = await owner.repository.findOne({
        filterByTk: target.recordId,
        filter: { $and: [...permissions.slice(0, 2), { [`${target.field}.id`]: target.attachmentId }] },
        transaction,
      });
      if (!related) throw new ProcessDocumentsError('DOCUMENT_NOT_FOUND', 'Вложение не найдено в этой карточке.');
      const record = await attachments.model.findByPk(target.attachmentId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!record) throw new ProcessDocumentsError('DOCUMENT_NOT_FOUND', 'Вложение не найдено.');
      const access = await attachments.repository.count({
        filterByTk: target.attachmentId,
        filter: permissions[2],
        transaction,
      });
      if (!access) throw new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'Нет права удалять этот файл.');
      await this.assertNotShared(target, transaction);
      if (
        await attachments.repository.count({
          filter: {
            id: { $ne: target.attachmentId },
            storageId: record.get('storageId'),
            filename: record.get('filename'),
            ...(record.get('path') ? { path: record.get('path') } : { $or: [{ path: '' }, { path: null }] }),
          },
          transaction,
        })
      )
        throw new ProcessDocumentsError('ATTACHMENT_IN_USE', 'Этот объект используется другим вложением.');
      const file = this.deletionFor(record as unknown as AttachmentModel);
      if (field.type === 'belongsToMany') {
        const relation = this.database.getRepository<MultipleRelationRepository>(
          `${owner.name}.${target.field}`,
          target.recordId,
        );
        await relation.remove({ tk: target.attachmentId, transaction });
      } else if (field.type === 'belongsTo') {
        const relation = this.database.getRepository<SingleRelationRepository>(
          `${owner.name}.${target.field}`,
          target.recordId,
        );
        await relation.remove({ transaction });
      }
      await record.destroy({ transaction, hooks: false });
      if (file.backend === 'minio') await this.enqueue('attachments', [file.key], { transaction });
      return file;
    });
    if (deletion.backend === 'local') await deletion.remove();
  }

  private async accessFilter(
    collection: Collection,
    action: string,
    actor: DocumentActor,
    field?: string,
  ): Promise<Filter> {
    if (actor.isRoot) return {};
    const context = actor.authorizationContext as AttachmentAccessContext;
    const permission = context.can?.({ resource: collection.name, action });
    const { filter, whitelist, blacklist } = permission?.params ?? {};
    if (!permission || (field && ((whitelist && !whitelist.includes(field)) || blacklist?.includes(field)))) {
      throw new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'Нет права удалять файл из этой карточки.');
    }
    if (!filter) return {};
    checkFilterParams(collection, filter);
    return (
      (await parseJsonTemplate(filter, {
        state: context.state,
        timezone: context.get('x-timezone'),
        userProvider: createUserProvider({ db: this.database, currentUser: context.state?.currentUser }),
      })) ?? filter
    );
  }

  private async assertNotShared(target: RecordAttachmentTarget, transaction: Transaction): Promise<void> {
    for (const collection of this.database.collections.values()) {
      for (const field of collection.getFields()) {
        if (
          field.options.target !== 'attachments' ||
          (field.options.interface !== 'attachment' &&
            !['belongsToMany', 'belongsTo', 'belongsToArray'].includes(field.type))
        )
          continue;
        const name: string = field.name;
        const sameField = collection.name === target.collection && name === target.field;
        const filter: Filter = { [`${name}.id`]: target.attachmentId };
        if (sameField) filter[collection.filterTargetKey as string] = { $ne: target.recordId };
        if (await collection.repository.count({ filter, transaction })) {
          throw new ProcessDocumentsError(
            'ATTACHMENT_IN_USE',
            'Файл прикреплён к другой карточке и не может быть удалён.',
          );
        }
      }
    }
  }
}
