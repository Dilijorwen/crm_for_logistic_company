/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import type { ChatStorage, StoreChatObjectInput } from '../../../application/ports/ChatStorage';

export interface MinioChatConfig {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

interface RequestOptions {
  method: string;
  key?: string;
  bucketOnly?: boolean;
  body?: Buffer | NodeJS.ReadableStream;
  contentLength?: number;
  contentType?: string;
  payloadHash?: string;
  headers?: Record<string, string>;
}

class MinioRequestError extends Error {
  statusCode?: number;
}

function statusCodeOf(error: unknown): number | undefined {
  return error instanceof MinioRequestError ? error.statusCode : undefined;
}

function hmac(key: crypto.BinaryLike | crypto.KeyObject, value: string): Buffer {
  return crypto.createHmac('sha256', key).update(value).digest();
}

function sha256(value: crypto.BinaryLike): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeS3Path(key: string): string {
  return key.split('/').map(encodePathSegment).join('/');
}

async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

export class MinioChatStorage implements ChatStorage {
  private readonly endpoint: URL;

  constructor(private readonly config: MinioChatConfig) {
    this.endpoint = new URL(config.endpoint);
  }

  async ensureReady(): Promise<void> {
    try {
      await this.request({ method: 'HEAD', bucketOnly: true });
    } catch (error) {
      const statusCode = statusCodeOf(error);
      if (statusCode !== 404 && statusCode !== 403) {
        throw error;
      }
      await this.request({ method: 'PUT', bucketOnly: true, body: Buffer.alloc(0) });
    }
  }

  async storeTemporary(input: StoreChatObjectInput): Promise<void> {
    const payloadHash = await sha256File(input.filePath);
    await this.request({
      method: 'PUT',
      key: input.key,
      body: fs.createReadStream(input.filePath),
      contentLength: input.size,
      contentType: input.contentType,
      payloadHash,
    });
  }

  async promote(temporaryKey: string, finalKey: string): Promise<void> {
    await this.request({
      method: 'PUT',
      key: finalKey,
      body: Buffer.alloc(0),
      headers: {
        'x-amz-copy-source': `/${encodePathSegment(this.config.bucket)}/${encodeS3Path(temporaryKey)}`,
      },
    });
  }

  async open(key: string): Promise<NodeJS.ReadableStream> {
    const response = await this.request({ method: 'GET', key, payloadHash: sha256(Buffer.alloc(0)) });
    if (!this.isReadableStream(response)) {
      throw new MinioRequestError('MinIO did not return an object stream.');
    }
    return response;
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.request({ method: 'DELETE', key, body: Buffer.alloc(0) });
      return true;
    } catch (error) {
      if (statusCodeOf(error) === 404) {
        return false;
      }
      throw error;
    }
  }

  private buildAuthorization(
    method: string,
    canonicalUri: string,
    headers: Record<string, string>,
    payloadHash: string,
  ): string {
    const amzDate = headers['x-amz-date'];
    const dateStamp = amzDate.slice(0, 8);
    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((key) => `${key}:${headers[key].trim()}\n`)
      .join('');
    const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256(canonicalRequest)].join('\n');
    const dateKey = hmac(`AWS4${this.config.secretKey}`, dateStamp);
    const regionKey = hmac(dateKey, this.config.region);
    const serviceKey = hmac(regionKey, 's3');
    const signingKey = hmac(serviceKey, 'aws4_request');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    return `AWS4-HMAC-SHA256 Credential=${this.config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  }

  private async request(options: RequestOptions): Promise<NodeJS.ReadableStream | true> {
    const method = options.method.toUpperCase();
    const payloadHash = options.payloadHash || sha256(Buffer.isBuffer(options.body) ? options.body : Buffer.alloc(0));
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const bucketPath = `/${encodePathSegment(this.config.bucket)}`;
    const canonicalUri = options.bucketOnly ? bucketPath : `${bucketPath}/${encodeS3Path(options.key || '')}`;
    const headers: Record<string, string> = {
      host: this.endpoint.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...options.headers,
    };
    if (options.contentType) headers['content-type'] = options.contentType;
    if (options.contentLength !== undefined) headers['content-length'] = String(options.contentLength);
    else if (Buffer.isBuffer(options.body)) headers['content-length'] = String(options.body.length);
    headers.authorization = this.buildAuthorization(method, canonicalUri, headers, payloadHash);

    return new Promise((resolve, reject) => {
      const transport = this.endpoint.protocol === 'https:' ? https : http;
      const request = transport.request(
        {
          method,
          hostname: this.endpoint.hostname,
          port: this.endpoint.port || (this.endpoint.protocol === 'https:' ? 443 : 80),
          path: canonicalUri,
          headers,
        },
        (response) => {
          const statusCode = response.statusCode || 500;
          if (method === 'GET' && statusCode >= 200 && statusCode < 300) {
            resolve(response);
            return;
          }
          const chunks: Buffer[] = [];
          response
            .on('data', (chunk) => chunks.push(Buffer.from(chunk)))
            .on('end', () => {
              if (statusCode >= 200 && statusCode < 300) {
                resolve(true);
                return;
              }
              const body = Buffer.concat(chunks).toString('utf8');
              const error = new MinioRequestError(body || `MinIO request failed with ${statusCode}`);
              error.statusCode = statusCode;
              reject(error);
            })
            .on('error', reject);
        },
      );
      request.on('error', reject);
      if (options.body && !Buffer.isBuffer(options.body)) {
        options.body.on('error', reject);
        options.body.pipe(request);
      } else {
        request.end(options.body);
      }
    });
  }

  private isReadableStream(value: NodeJS.ReadableStream | true): value is NodeJS.ReadableStream {
    return value !== true && typeof value.pipe === 'function';
  }
}

export function readChatMinioConfig(environment: NodeJS.ProcessEnv): MinioChatConfig {
  const accessKey = environment.CHAT_MINIO_ACCESS_KEY || environment.PROCESS_DOCUMENTS_MINIO_ACCESS_KEY;
  const secretKey = environment.CHAT_MINIO_SECRET_KEY || environment.PROCESS_DOCUMENTS_MINIO_SECRET_KEY;
  if (!accessKey || !secretKey) {
    throw new Error('Chat MinIO credentials are required.');
  }
  return {
    endpoint:
      environment.CHAT_MINIO_ENDPOINT || environment.PROCESS_DOCUMENTS_MINIO_ENDPOINT || 'http://minio:9000',
    region: environment.CHAT_MINIO_REGION || environment.PROCESS_DOCUMENTS_MINIO_REGION || 'us-east-1',
    accessKey,
    secretKey,
    bucket: environment.CHAT_MINIO_BUCKET || 'log-company-chats',
  };
}
