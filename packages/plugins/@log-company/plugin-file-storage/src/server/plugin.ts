/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import path from 'path';
import { Plugin } from '@nocobase/server';
import PluginFileManager from '@nocobase/plugin-file-manager/server';
import type { Transaction } from '@nocobase/database';
import type { Context } from '@nocobase/actions';
import { readFileStorageConfig } from './infrastructure/minio/FileStorageConfig';
import { FileStorageService } from './infrastructure/FileStorageService';
import { FileDeletionQueue } from './infrastructure/nocobase/FileDeletionQueue';
import {
  createPrivateMinioStorageType,
  NativeUploadRollback,
  PRIVATE_MINIO_TYPE,
} from './infrastructure/nocobase/PrivateMinioStorageType';
import { FileStorageController } from './interfaces/FileStorageController';
import { OpenStoredAttachment } from './application/OpenStoredAttachment';
import { NocoBaseStoredAttachmentRepository } from './infrastructure/nocobase/NocoBaseStoredAttachmentRepository';
import { SignedFileLinkVerifier } from './infrastructure/nocobase/SignedFileLinkVerifier';
import { readOrCreateFileLinkSecret } from './infrastructure/nocobase/FileLinkSecret';

export default class PluginFileStorage extends Plugin {
  storage!: FileStorageService;
  deletionQueue!: FileDeletionQueue;

  async load(): Promise<void> {
    const config = readFileStorageConfig(process.env, this.app.name);
    const secret = await readOrCreateFileLinkSecret(this.app.name);
    this.storage = new FileStorageService(config, (area, operation, code) => {
      this.log.error('Ошибка файлового хранилища.', { area, operation, code });
    });
    await this.storage.ensureReady();
    this.deletionQueue = new FileDeletionQueue(this.db, this.storage, this.app.name, (message, code) =>
      this.log.error(message, { code }),
    );
    this.app.on('afterStart', this.startDeletionQueue);
    this.app.on('beforeStop', this.stopDeletionQueue);
    const destroyTransactions = new WeakMap<object, Transaction>();
    this.db.on('beforeDestroy', (record: object, { transaction }: { transaction?: Transaction }) => {
      if (transaction) destroyTransactions.set(record, transaction);
    });
    const rollback = new NativeUploadRollback(this.deletionQueue, (code) => {
      this.log.error('Не удалось запланировать очистку вложения после ошибки загрузки.', { code });
    });
    const fileManager = this.app.pm.get(PluginFileManager);
    this.db.on(
      'attachments.beforeSave',
      (record: Parameters<typeof rollback.assertBinding>[0], options: { context?: Context }) => {
        rollback.assertBinding(record, options.context, (storageId) =>
          [...fileManager.storagesCache].some(
            ([id, storage]) => String(id) === String(storageId) && storage.type === PRIVATE_MINIO_TYPE,
          ),
        );
      },
    );
    this.app.resourceManager.use((context, next) => rollback.handle(context as Context, next), {
      tag: 'private-file-upload-rollback',
      before: 'createMiddleware',
    });
    fileManager.registerStorageType(
      PRIVATE_MINIO_TYPE,
      createPrivateMinioStorageType(
        this.storage.area('attachments'),
        this.deletionQueue,
        secret,
        this.app.name,
        destroyTransactions,
        rollback,
        (code) => this.log.warn('Не удалось удалить временный файл вложения.', { code }),
      ),
    );
    new FileStorageController(
      this,
      new OpenStoredAttachment(
        new NocoBaseStoredAttachmentRepository(this.db),
        new SignedFileLinkVerifier(secret, config.application || 'main'),
        this.storage.area('attachments'),
      ),
    ).register();
    this.db.addMigrations({
      namespace: 'log-company-file-storage',
      directory: path.resolve(__dirname, 'migrations'),
      context: { plugin: this },
    });
  }

  private readonly startDeletionQueue = () => this.deletionQueue.start();
  private readonly stopDeletionQueue = () => this.deletionQueue.stop();

  async remove(): Promise<void> {
    this.app.off('afterStart', this.startDeletionQueue);
    this.app.off('beforeStop', this.stopDeletionQueue);
    await this.deletionQueue?.stop();
  }
}
