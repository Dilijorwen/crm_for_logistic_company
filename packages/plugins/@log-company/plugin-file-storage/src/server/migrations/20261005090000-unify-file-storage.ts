/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import fs from 'fs/promises';
import path from 'path';
import { Migration } from '@nocobase/server';
import { readFileStorageConfig } from '../infrastructure/minio/FileStorageConfig';
import { MinioObjectClient, isMissingObject } from '../infrastructure/minio/MinioObjectClient';
import { MinioStorageArea } from '../infrastructure/minio/MinioStorageArea';
import { PRIVATE_MINIO_TYPE, UNIFIED_STORAGE_NAME } from '../infrastructure/nocobase/PrivateMinioStorageType';

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const config = readFileStorageConfig(process.env, this.app.name);
    const client = new MinioObjectClient(config);
    await client.ensureBucket();
    for (const [areaName, legacyConfig] of Object.entries(config.legacy || {})) {
      if (!legacyConfig) continue;
      const legacy = new MinioObjectClient(legacyConfig);
      let keys: string[];
      try {
        keys = await legacy.listObjects('');
      } catch (error) {
        if (isMissingObject(error)) continue;
        throw error;
      }
      const area = new MinioStorageArea(config, areaName);
      for (const key of keys) {
        if (legacyConfig.bucket === config.bucket && key.startsWith('v1/')) continue;
        const source = await legacy.statObject(key);
        await client.copyFrom(legacy, key, area.objectKey(key));
        const copied = await client.statObject(area.objectKey(key));
        if (source.size !== copied.size) throw new Error('Размер перенесённого объекта не совпадает с исходным.');
      }
    }

    const storages = this.db.getRepository('storages');
    let unified = await storages.findOne({ filter: { name: UNIFIED_STORAGE_NAME } });
    if (!unified)
      unified = await storages.create({
        values: {
          name: UNIFIED_STORAGE_NAME,
          title: 'Файлы Log Company',
          type: PRIVATE_MINIO_TYPE,
          path: '',
          options: {},
          rules: { mimetype: '*', size: 100 * 1024 * 1024 },
          default: false,
          paranoid: true,
        },
      });
    const area = new MinioStorageArea(config, 'attachments');
    const localStorages = await storages.find({ filter: { type: 'local' } });
    const transferredAttachmentIds: Array<string | number> = [];
    for (const local of localStorages) {
      const options = (local.get('options') || {}) as { documentRoot?: string };
      const root = path.resolve(options.documentRoot || 'storage/uploads');
      const files = await this.db.getRepository('attachments').find({ filter: { storageId: local.get('id') } });
      for (const file of files) {
        const key = [file.get('path'), file.get('filename')].filter(Boolean).join('/');
        const sourcePath = path.resolve(root, key);
        if (!sourcePath.startsWith(root + path.sep)) throw new Error('Недопустимый путь вложения.');
        const stat = await fs.stat(sourcePath);
        await area.store({
          key,
          filePath: sourcePath,
          size: stat.size,
          contentType: String(file.get('mimetype') || 'application/octet-stream'),
        });
        const copied = await client.statObject(area.objectKey(key));
        if (copied.size !== stat.size) throw new Error('Не удалось проверить перенос вложения.');
        transferredAttachmentIds.push(file.get('id'));
      }
    }
    await this.db.sequelize.transaction(async (transaction) => {
      for (const id of transferredAttachmentIds) {
        await this.db.getRepository('attachments').update({
          filterByTk: id,
          values: { storageId: unified.get('id'), url: null },
          transaction,
        });
      }
      for (const local of localStorages) {
        await storages.update({ filterByTk: local.get('id'), values: { default: false }, transaction });
      }
      await storages.update({ filterByTk: unified.get('id'), values: { default: true }, transaction });
      await this.db.sequelize.query(
        `
        update fields set options = jsonb_set(options::jsonb, '{storage}', to_jsonb(:storageName::text))::json
        where options->>'storage' = 'local'
      `,
        { replacements: { storageName: UNIFIED_STORAGE_NAME }, transaction },
      );
    });
  }
}
