/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import fs from 'fs/promises';
import os from 'os';
import multer from 'multer';
import type { Readable } from 'stream';
import { callbackify } from 'util';
import { StorageType, type AttachmentModel, type StorageEngine } from '@nocobase/plugin-file-manager/server';
import type { Transaction } from '@nocobase/database';
import type { Context, Next } from '@nocobase/actions';
import { FileStorageError } from '../../domain/FileStorageError';
import { InvalidUploadError, nativeAttachmentUpload } from '../../domain/UploadPolicy';
import { generateFileKey, type FileStorageArea } from '../FileStorageService';
import { inspectUpload } from '../InspectUpload';
import type { FileDeletionQueue } from './FileDeletionQueue';
import { signFileLink } from './SignedFileLink';

export const PRIVATE_MINIO_TYPE = 'log-company-private-minio';
export const UNIFIED_STORAGE_NAME = 'log-company-files';

interface PendingUpload {
  key: string;
  filename: string;
  storageId: number;
  mimeType: string;
}

interface AttachmentRecord {
  isNewRecord?: boolean;
  get(field: string): unknown;
  previous(field: string): unknown;
  changed(field: string): boolean;
}

export class NativeUploadRollback {
  private readonly uploads = new WeakMap<object, PendingUpload>();

  constructor(
    private readonly queue: FileDeletionQueue,
    private readonly onFailure: (code: string) => void,
  ) {}

  record(request: object, upload: PendingUpload): void {
    this.uploads.set(request, upload);
  }

  assertBinding(
    record: AttachmentRecord,
    context: Context | undefined,
    isPrivate: (storageId: unknown) => boolean,
  ): void {
    if (!context?.req) return;
    const storageId = record.get('storageId');
    if (!isPrivate(storageId) && !isPrivate(record.previous('storageId'))) return;
    const keyFields = ['storageId', 'path', 'filename', 'mimetype'];
    if (!record.isNewRecord && !keyFields.some((field) => record.changed(field))) return;
    const upload = this.uploads.get(context.req);
    const key = [record.get('path'), record.get('filename')].filter(Boolean).join('/');
    if (
      !upload ||
      !isPrivate(storageId) ||
      String(upload.storageId) !== String(storageId) ||
      key !== upload.key ||
      record.get('mimetype') !== upload.mimeType
    ) {
      context.throw(400, 'Чтобы изменить содержимое вложения, загрузите файл.');
    }
  }

  readonly handle = async (context: Context, next: Next): Promise<void> => {
    try {
      await next();
      if (context.status >= 400) await this.compensate(context);
    } catch (error) {
      await this.compensate(context);
      if (error instanceof FileStorageError) {
        context.throw(error.code === 'conflict' ? 409 : 503, error.message);
      }
      throw error;
    } finally {
      this.uploads.delete(context.req);
    }
  };

  private async compensate(context: Context): Promise<void> {
    const upload = this.uploads.get(context.req);
    if (!upload) return;
    try {
      const repository = context.db.getRepository(context.action.resourceName);
      // A response error can happen after the attachment record has committed.
      const attachment = await repository.findOne({
        filter: { filename: upload.filename, storageId: upload.storageId },
      });
      if (!attachment) await this.queue.enqueue('attachments', [upload.key], { currentOnly: true });
    } catch (error) {
      this.onFailure(error instanceof Error ? error.name : 'UnknownError');
    }
  }
}

export function createPrivateMinioStorageType(
  area: FileStorageArea,
  queue: FileDeletionQueue,
  secret: string,
  application: string,
  destroyTransactions: WeakMap<object, Transaction>,
  rollback: NativeUploadRollback,
  onTempFileError: (code: string) => void,
) {
  return class PrivateMinioStorageType extends StorageType {
    private uploadKey(filename: string): string {
      return [(this.storage.path || '').replace(/^\/|\/$/g, ''), filename].filter(Boolean).join('/');
    }

    make(): StorageEngine {
      const disk = multer.diskStorage({
        destination: os.tmpdir(),
      });
      const persist = async (request: object, originalName: string, info: Partial<Express.Multer.File>) => {
        if (!info.path || info.size === undefined) throw new InvalidUploadError('Не удалось принять файл.');
        try {
          const filename = generateFileKey('', originalName);
          const verifiedMimeType = await inspectUpload(
            { path: info.path, originalName, size: info.size },
            nativeAttachmentUpload,
          );
          const key = this.uploadKey(filename);
          await area.store({
            key,
            filePath: info.path,
            size: info.size,
            contentType: verifiedMimeType,
          });
          if (this.storage.id !== undefined) {
            rollback.record(request, { key, filename, storageId: this.storage.id, mimeType: verifiedMimeType });
          }
          return { filename, size: info.size, verifiedMimeType };
        } catch (error) {
          // File Manager's multipart adapter recognizes this name as a client upload error.
          if (error instanceof InvalidUploadError) error.name = 'MulterError';
          throw error;
        } finally {
          try {
            await fs.rm(info.path, { force: true });
          } catch (error) {
            onTempFileError(error instanceof Error ? error.name : 'UnknownError');
          }
        }
      };
      const finishUpload = callbackify(persist);
      const removeUpload = callbackify(async (file: Express.Multer.File): Promise<void> => {
        await queue.enqueue('attachments', [this.uploadKey(file.filename)], { currentOnly: true });
      });
      return {
        _handleFile(request, file, callback) {
          disk._handleFile(request, file, (error, info) => {
            if (error) {
              callback(error);
              return;
            }
            finishUpload(request, file.originalname, info ?? {}, callback);
          });
        },
        _removeFile(_request, file, callback) {
          removeUpload(file, callback);
        },
      };
    }

    getFileData(file: Express.Multer.File & { verifiedMimeType?: string }, meta: object = {}) {
      const data = super.getFileData(file, meta);
      return { ...data, mimetype: file.verifiedMimeType || data.mimetype };
    }

    async exists(record: AttachmentModel): Promise<boolean> {
      try {
        const stream = await area.open(this.getFileKey(record));
        stream.destroy();
        return true;
      } catch (error) {
        if (error instanceof FileStorageError && error.code === 'not-found') return false;
        throw error;
      }
    }

    copy(source: AttachmentModel, target: AttachmentModel): Promise<void> {
      return area.promote(this.getFileKey(source), this.getFileKey(target));
    }

    async delete(records: AttachmentModel[]): Promise<[number, AttachmentModel[]]> {
      for (const record of records) {
        await queue.enqueue('attachments', [this.getFileKey(record)], { transaction: destroyTransactions.get(record) });
      }
      return [records.length, []];
    }

    getFileURL(record: AttachmentModel): string {
      const id = String(record.id);
      const expires = Math.floor(Date.now() / 1000) + 300;
      const signature = signFileLink(id, expires, secret, application);
      const base = (process.env.APP_PUBLIC_PATH || '/').replace(/\/$/, '');
      return `${base}/api/fileStorage:open?id=${encodeURIComponent(id)}&expires=${expires}&signature=${signature}`;
    }

    async getFileStream(record: AttachmentModel): Promise<{ stream: Readable; contentType?: string }> {
      return { stream: await area.open(this.getFileKey(record)), contentType: record.mimetype };
    }
  };
}
