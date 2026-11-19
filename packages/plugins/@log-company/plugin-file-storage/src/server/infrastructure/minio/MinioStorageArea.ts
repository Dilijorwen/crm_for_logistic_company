/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Readable } from 'stream';
import { storageAreaPrefix, validateStorageKey } from '../../domain/StorageKey';
import type { FileStorageConfig } from './FileStorageConfig';
import { MinioObjectClient, isMissingObject } from './MinioObjectClient';

export class MinioStorageArea {
  readonly prefix: string;
  private readonly client: MinioObjectClient;
  private readonly legacy?: MinioObjectClient;

  constructor(config: FileStorageConfig, area: string, client = new MinioObjectClient(config)) {
    this.prefix = storageAreaPrefix(config.application || 'main', area);
    this.client = client;
    const legacyConfig = config.legacy?.[area];
    if (legacyConfig) {
      this.legacy = new MinioObjectClient(legacyConfig);
    }
  }

  ensureReady(): Promise<void> {
    return this.client.ensureBucket();
  }

  store(input: {
    key: string;
    filePath: string;
    size: number;
    contentType: string;
    createOnly?: boolean;
  }): Promise<void> {
    return this.client.putObject({ ...input, key: this.objectKey(input.key) });
  }

  async open(key: string): Promise<Readable> {
    try {
      return await this.client.getObject(this.objectKey(key));
    } catch (error) {
      const legacy = this.legacyFor(key);
      if (!legacy || !isMissingObject(error)) throw error;
      return legacy.getObject(validateStorageKey(key));
    }
  }

  async promote(temporaryKey: string, finalKey: string): Promise<void> {
    await this.client.copyObject(this.objectKey(temporaryKey), this.objectKey(finalKey));
  }

  promoteNew(temporaryKey: string, finalKey: string): Promise<void> {
    return this.client.copyNewObject(this.objectKey(temporaryKey), this.objectKey(finalKey));
  }

  async listKeys(prefix: string): Promise<string[]> {
    const keys = await this.client.listObjects(prefix ? this.objectKey(prefix) : this.prefix);
    return keys.map((key) => key.slice(this.prefix.length));
  }

  async delete(key: string): Promise<boolean> {
    await this.deleteCurrent(key);
    const legacy = this.legacyFor(key);
    if (legacy) {
      try {
        await legacy.deleteObject(validateStorageKey(key));
      } catch (error) {
        if (!isMissingObject(error)) throw error;
      }
    }
    return true;
  }

  deleteCurrent(key: string): Promise<boolean> {
    return this.client.deleteObject(this.objectKey(key));
  }

  private legacyFor(key: string): MinioObjectClient | undefined {
    // A legacy bucket can share the target name. Its fallback must stay outside all v1 namespaces.
    if (key.startsWith('v1/') && this.legacy?.config.bucket === this.client.config.bucket) return undefined;
    return this.legacy;
  }

  objectKey(key: string): string {
    return this.prefix + validateStorageKey(key);
  }
}
