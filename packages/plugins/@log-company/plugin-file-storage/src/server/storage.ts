/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export { MinioObjectClient } from './infrastructure/minio/MinioObjectClient';
export { MinioStorageArea } from './infrastructure/minio/MinioStorageArea';
export { readFileStorageConfig } from './infrastructure/minio/FileStorageConfig';
export type { MinioConfig, FileStorageConfig } from './infrastructure/minio/FileStorageConfig';
export { canPreviewInline } from './domain/PreviewPolicy';
export { FileStorageError } from './domain/FileStorageError';
export { FileStorageArea, FileStorageService, generateFileKey } from './infrastructure/FileStorageService';
export { fileResponseHeaders } from './interfaces/fileResponseHeaders';
export { inspectUpload } from './infrastructure/InspectUpload';
export { InvalidUploadError, processDocumentUpload, validateUploadBatch } from './domain/UploadPolicy';
