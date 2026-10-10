/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import multer from 'multer';
import type { Readable } from 'stream';
import { callbackify } from 'util';
import { StorageType, type AttachmentModel, type StorageEngine } from '@nocobase/plugin-file-manager/server';
import type { FileStorageConfig } from '../minio/FileStorageConfig';
import { MinioStorageArea } from '../minio/MinioStorageArea';
import { isMissingObject } from '../minio/MinioObjectClient';
import { signFileLink } from './SignedFileLink';

export const PRIVATE_MINIO_TYPE = 'log-company-private-minio';
export const UNIFIED_STORAGE_NAME = 'log-company-files';

export function createPrivateMinioStorageType(config: FileStorageConfig, secret: string) {
  const area = new MinioStorageArea(config, 'attachments');
  return class PrivateMinioStorageType extends StorageType {
    make(): StorageEngine {
      const disk = multer.diskStorage({
        destination: os.tmpdir(),
        filename: (_request, file, callback) => {
          const extension = path.extname(file.originalname).toLowerCase();
          callback(null, `${crypto.randomUUID()}${/^\.[a-z0-9]{1,10}$/.test(extension) ? extension : ''}`);
        },
      });
      const persist = async (info: Partial<Express.Multer.File>) => {
        if (!info.path || !info.filename || info.size === undefined) throw new Error('Не удалось принять файл.');
        try {
          await area.store({
            key: info.filename,
            filePath: info.path,
            size: info.size,
            contentType: info.mimetype || 'application/octet-stream',
          });
          return { filename: info.filename, size: info.size };
        } finally {
          await fs.unlink(info.path);
        }
      };
      const finishUpload = callbackify(persist);
      const removeUpload = callbackify(async (file: Express.Multer.File): Promise<void> => {
        await area.delete(file.filename);
      });
      return {
        _handleFile(request, file, callback) {
          disk._handleFile(request, file, (error, info) => {
            if (error) {
              callback(error);
              return;
            }
            finishUpload({ ...info, mimetype: file.mimetype }, callback);
          });
        },
        _removeFile(_request, file, callback) {
          removeUpload(file, callback);
        },
      };
    }

    async exists(record: AttachmentModel): Promise<boolean> {
      try {
        const stream = await area.open(this.getFileKey(record));
        stream.destroy();
        return true;
      } catch (error) {
        if (isMissingObject(error)) return false;
        throw error;
      }
    }

    copy(source: AttachmentModel, target: AttachmentModel): Promise<void> {
      return area.promote(this.getFileKey(source), this.getFileKey(target));
    }

    async delete(records: AttachmentModel[]): Promise<[number, AttachmentModel[]]> {
      for (const record of records) await area.delete(this.getFileKey(record));
      return [records.length, []];
    }

    getFileURL(record: AttachmentModel): string {
      const id = String(record.id);
      const expires = Math.floor(Date.now() / 1000) + 300;
      const signature = signFileLink(id, expires, secret, config.application || 'main');
      const base = (process.env.APP_PUBLIC_PATH || '/').replace(/\/$/, '');
      return `${base}/api/fileStorage:open?id=${encodeURIComponent(id)}&expires=${expires}&signature=${signature}`;
    }

    async getFileStream(record: AttachmentModel): Promise<{ stream: Readable; contentType?: string }> {
      return { stream: await area.open(this.getFileKey(record)), contentType: record.mimetype };
    }
  };
}
