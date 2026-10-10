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
import { readFileStorageConfig } from './infrastructure/minio/FileStorageConfig';
import { MinioStorageArea } from './infrastructure/minio/MinioStorageArea';
import { createPrivateMinioStorageType, PRIVATE_MINIO_TYPE } from './infrastructure/nocobase/PrivateMinioStorageType';
import { FileStorageController } from './interfaces/FileStorageController';
import { OpenStoredAttachment } from './application/OpenStoredAttachment';
import { NocoBaseStoredAttachmentRepository } from './infrastructure/nocobase/NocoBaseStoredAttachmentRepository';
import { SignedFileLinkVerifier } from './infrastructure/nocobase/SignedFileLinkVerifier';
import { readOrCreateFileLinkSecret } from './infrastructure/nocobase/FileLinkSecret';

export default class PluginFileStorage extends Plugin {
  async load(): Promise<void> {
    const config = readFileStorageConfig(process.env, this.app.name);
    const secret = await readOrCreateFileLinkSecret(this.app.name);
    await new MinioStorageArea(config, 'attachments').ensureReady();
    this.app.pm
      .get(PluginFileManager)
      .registerStorageType(PRIVATE_MINIO_TYPE, createPrivateMinioStorageType(config, secret));
    new FileStorageController(
      this,
      new OpenStoredAttachment(
        new NocoBaseStoredAttachmentRepository(this.db),
        new SignedFileLinkVerifier(secret, config.application || 'main'),
        new MinioStorageArea(config, 'attachments'),
      ),
    ).register();
    this.db.addMigrations({
      namespace: 'log-company-file-storage',
      directory: path.resolve(__dirname, 'migrations'),
      context: { plugin: this },
    });
  }
}
