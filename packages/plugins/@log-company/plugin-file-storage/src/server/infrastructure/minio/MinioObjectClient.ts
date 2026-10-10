/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import fs from 'fs';
import type { Readable } from 'stream';
import { validateStorageKey } from '../../domain/StorageKey';
import type { MinioConfig } from './FileStorageConfig';

export function isMissingObject(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const value = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    value.$metadata?.httpStatusCode === 404 || ['NoSuchKey', 'NoSuchBucket', 'NotFound'].includes(value.name || '')
  );
}

export class MinioObjectClient {
  private readonly client: S3Client;

  constructor(readonly config: MinioConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
    } catch (error) {
      if (!isMissingObject(error)) throw error;
      await this.client.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
    }
  }

  async putObject(input: { key: string; filePath: string; size: number; contentType?: string }): Promise<void> {
    const stream = fs.createReadStream(input.filePath);
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: validateStorageKey(input.key),
          Body: stream,
          ContentLength: input.size,
          ContentType: input.contentType || 'application/octet-stream',
        }),
      );
    } finally {
      stream.destroy();
    }
  }

  async getObject(key: string): Promise<Readable> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: validateStorageKey(key) }),
    );
    if (!response.Body || typeof (response.Body as Readable).pipe !== 'function') {
      throw new Error('Хранилище не вернуло поток файла.');
    }
    return response.Body as Readable;
  }

  async statObject(key: string): Promise<{ size: number; contentType?: string }> {
    const response = await this.client.send(
      new HeadObjectCommand({ Bucket: this.config.bucket, Key: validateStorageKey(key) }),
    );
    return { size: response.ContentLength || 0, contentType: response.ContentType };
  }

  async copyObject(sourceKey: string, targetKey: string, sourceBucket = this.config.bucket): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.config.bucket,
        Key: validateStorageKey(targetKey),
        CopySource: `/${encodeURIComponent(sourceBucket)}/${validateStorageKey(sourceKey)
          .split('/')
          .map(encodeURIComponent)
          .join('/')}`,
      }),
    );
  }

  async copyFrom(source: MinioObjectClient, sourceKey: string, targetKey: string): Promise<void> {
    if (
      source.config.endpoint.replace(/\/$/, '') === this.config.endpoint.replace(/\/$/, '') &&
      source.config.accessKey === this.config.accessKey &&
      source.config.secretKey === this.config.secretKey
    ) {
      await this.copyObject(sourceKey, targetKey, source.config.bucket);
      return;
    }
    const metadata = await source.statObject(sourceKey);
    const stream = await source.getObject(sourceKey);
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: validateStorageKey(targetKey),
          Body: stream,
          ContentLength: metadata.size,
          ContentType: metadata.contentType || 'application/octet-stream',
        }),
      );
    } finally {
      stream.destroy();
    }
  }

  async listObjects(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: prefix,
          EncodingType: 'url',
          ContinuationToken: continuationToken,
        }),
      );
      for (const item of response.Contents || []) {
        if (item.Key)
          keys.push(response.EncodingType === 'url' ? decodeURIComponent(item.Key.replace(/\+/g, '%20')) : item.Key);
      }
      if (response.IsTruncated && !response.NextContinuationToken) {
        throw new Error('Хранилище не вернуло продолжение списка файлов.');
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);
    return keys;
  }

  async deleteObject(key: string): Promise<boolean> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: validateStorageKey(key) }));
    return true;
  }
}
