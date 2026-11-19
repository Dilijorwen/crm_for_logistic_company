/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { randomUUID } from 'node:crypto';
import { FileStorageError } from '../domain/FileStorageError';
import { validateStorageKey } from '../domain/StorageKey';
import { uploadExtension } from '../domain/UploadPolicy';
import type { FileStorageConfig } from './minio/FileStorageConfig';
import { isMissingObject, MinioObjectClient } from './minio/MinioObjectClient';
import { MinioStorageArea } from './minio/MinioStorageArea';

export const fileStorageAreas = ['process-documents', 'attachments', 'chat-attachments'] as const;
export type FileStorageAreaName = (typeof fileStorageAreas)[number];

export function generateFileKey(ownerPath: string, filename: string): string {
  const extension = uploadExtension(filename);
  const name = randomUUID() + (/^\.[a-z0-9]{1,16}$/.test(extension) ? extension : '');
  return validateStorageKey(ownerPath ? `${ownerPath}/${name}` : name);
}

export class FileStorageArea {
  constructor(
    private readonly area: MinioStorageArea,
    private readonly onFailure: (operation: string, errorName: string) => void,
  ) {}

  store(input: Parameters<MinioStorageArea['store']>[0]) {
    return this.execute('store', () => this.area.store({ ...input, createOnly: true }));
  }

  open(key: string) {
    return this.execute('open', () => this.area.open(key));
  }

  promote(source: string, target: string) {
    return this.execute('copy', () => this.area.promoteNew(source, target));
  }

  listKeys(prefix: string) {
    return this.execute('list', () => this.area.listKeys(prefix));
  }

  delete(key: string, currentOnly = false) {
    return this.execute('delete', () => (currentOnly ? this.area.deleteCurrent(key) : this.area.delete(key)));
  }

  private async execute<T>(operation: string, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (operation === 'open' && isMissingObject(error)) throw new FileStorageError('not-found');
      if (['store', 'copy'].includes(operation) && error instanceof Error && error.name === 'PreconditionFailed') {
        throw new FileStorageError('conflict');
      }
      this.onFailure(operation, error instanceof Error ? error.name : 'UnknownError');
      throw new FileStorageError('unavailable');
    }
  }
}

export class FileStorageService {
  private readonly client: MinioObjectClient;
  private readonly areas = new Map<FileStorageAreaName, FileStorageArea>();

  constructor(
    config: FileStorageConfig,
    onFailure: (area: FileStorageAreaName, operation: string, code: string) => void,
  ) {
    this.client = new MinioObjectClient(config);
    for (const name of fileStorageAreas) {
      this.areas.set(
        name,
        new FileStorageArea(new MinioStorageArea(config, name, this.client), (operation, code) => {
          onFailure(name, operation, code);
        }),
      );
    }
  }

  ensureReady(): Promise<void> {
    return this.client.ensureBucket();
  }

  area(name: FileStorageAreaName): FileStorageArea {
    const area = this.areas.get(name);
    if (!area) throw new Error('Неизвестная область файлового хранилища.');
    return area;
  }
}
