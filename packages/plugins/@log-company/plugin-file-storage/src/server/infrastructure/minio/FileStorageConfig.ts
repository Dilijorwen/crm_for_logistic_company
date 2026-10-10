/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export interface MinioConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

export interface FileStorageConfig extends MinioConfig {
  application?: string;
  legacy?: Partial<Record<string, MinioConfig>>;
}

export function readFileStorageConfig(environment: NodeJS.ProcessEnv, application = 'main'): FileStorageConfig {
  const accessKey = environment.FILE_STORAGE_ACCESS_KEY || environment.PROCESS_DOCUMENTS_MINIO_ACCESS_KEY;
  const secretKey = environment.FILE_STORAGE_SECRET_KEY || environment.PROCESS_DOCUMENTS_MINIO_SECRET_KEY;
  if (!accessKey || !secretKey) {
    throw new Error('Настройте FILE_STORAGE_ACCESS_KEY и FILE_STORAGE_SECRET_KEY.');
  }
  const config: FileStorageConfig = {
    endpoint: environment.FILE_STORAGE_ENDPOINT || environment.PROCESS_DOCUMENTS_MINIO_ENDPOINT || 'http://minio:9000',
    region: environment.FILE_STORAGE_REGION || environment.PROCESS_DOCUMENTS_MINIO_REGION || 'us-east-1',
    bucket: environment.FILE_STORAGE_BUCKET || 'log-company-files',
    accessKey,
    secretKey,
    application,
  };
  config.legacy = {
    'process-documents': {
      ...config,
      bucket: environment.PROCESS_DOCUMENTS_MINIO_BUCKET || 'log-company-process-documents',
      endpoint: environment.PROCESS_DOCUMENTS_MINIO_ENDPOINT || config.endpoint,
      region: environment.PROCESS_DOCUMENTS_MINIO_REGION || config.region,
      accessKey: environment.PROCESS_DOCUMENTS_MINIO_ACCESS_KEY || accessKey,
      secretKey: environment.PROCESS_DOCUMENTS_MINIO_SECRET_KEY || secretKey,
    },
    'chat-attachments': {
      ...config,
      bucket: environment.CHAT_MINIO_BUCKET || 'log-company-chats',
      endpoint: environment.CHAT_MINIO_ENDPOINT || config.endpoint,
      region: environment.CHAT_MINIO_REGION || config.region,
      accessKey: environment.CHAT_MINIO_ACCESS_KEY || accessKey,
      secretKey: environment.CHAT_MINIO_SECRET_KEY || secretKey,
    },
  };
  return config;
}
