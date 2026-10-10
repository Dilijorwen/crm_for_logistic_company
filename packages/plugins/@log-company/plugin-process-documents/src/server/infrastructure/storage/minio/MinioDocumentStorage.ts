/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { MinioStorageArea, readFileStorageConfig, type FileStorageConfig } from '@log-company/plugin-file-storage';
import type { DocumentStorage } from '../../../application/ports/DocumentStorage';

export class MinioDocumentStorage extends MinioStorageArea implements DocumentStorage {
  constructor(config: FileStorageConfig) {
    super(config, 'process-documents');
  }
}

export const readMinioConfig = readFileStorageConfig;
