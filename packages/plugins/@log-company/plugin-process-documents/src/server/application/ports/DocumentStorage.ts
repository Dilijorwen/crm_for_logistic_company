/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export interface StoreDocumentInput {
  key: string;
  filePath: string;
  size: number;
  contentType: string;
}

export interface DocumentStorage {
  ensureReady(): Promise<void>;
  store(input: StoreDocumentInput): Promise<void>;
  open(key: string): Promise<unknown>;
  listKeys(prefix: string): Promise<string[]>;
  delete(key: string): Promise<boolean>;
}

export interface StorageKeyGenerator {
  generate(ownerPath: string, originalFilename: string): string;
}

export interface IdentifierGenerator {
  generate(): string;
}

export interface ApplicationLogger {
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error: unknown, metadata?: Record<string, unknown>): void;
}
