import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { URL } from 'url';

type RequestOptions = {
  method: string;
  key?: string;
  bucketOnly?: boolean;
  body?: Buffer | NodeJS.ReadableStream;
  contentLength?: number;
  contentType?: string;
  payloadHash?: string;
};

export type MinioS3Config = {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
};

interface MinioResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

class MinioRequestError extends Error {
  statusCode?: number;
  body?: string;
}

function statusCodeOf(error: unknown): number | undefined {
  return error instanceof MinioRequestError ? error.statusCode : undefined;
}

function hmac(key: crypto.BinaryLike | crypto.KeyObject, value: string) {
  return crypto.createHmac('sha256', key).update(value).digest();
}

function sha256(value: crypto.BinaryLike) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeS3Path(key: string) {
  return key.split('/').map(encodePathSegment).join('/');
}

export async function sha256File(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

export class MinioS3Client {
  private endpoint: URL;

  constructor(private config: MinioS3Config) {
    this.endpoint = new URL(config.endpoint);
  }

  async ensureBucket() {
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

  async putObject(options: { key: string; filePath: string; size: number; contentType?: string }) {
    const payloadHash = await sha256File(options.filePath);
    await this.request({
      method: 'PUT',
      key: options.key,
      body: fs.createReadStream(options.filePath),
      contentLength: options.size,
      contentType: options.contentType || 'application/octet-stream',
      payloadHash,
    });
  }

  async getObject(key: string) {
    return this.request({ method: 'GET', key, payloadHash: sha256(Buffer.alloc(0)) });
  }

  async deleteObject(key: string) {
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

  private buildAuth(method: string, canonicalUri: string, headers: Record<string, string>, payloadHash: string) {
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
    const dateRegionKey = hmac(dateKey, this.config.region);
    const dateRegionServiceKey = hmac(dateRegionKey, 's3');
    const signingKey = hmac(dateRegionServiceKey, 'aws4_request');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    return `AWS4-HMAC-SHA256 Credential=${this.config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  }

  private async request(options: RequestOptions): Promise<NodeJS.ReadableStream | MinioResponse> {
    const method = options.method.toUpperCase();
    const payloadHash = options.payloadHash || sha256(Buffer.isBuffer(options.body) ? options.body : Buffer.alloc(0));
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const bucketPath = `/${encodePathSegment(this.config.bucket)}`;
    const canonicalUri = options.bucketOnly ? bucketPath : `${bucketPath}/${encodeS3Path(options.key || '')}`;
    const headers: Record<string, string> = {
      host: this.endpoint.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };

    if (options.contentType) {
      headers['content-type'] = options.contentType;
    }
    if (options.contentLength != null) {
      headers['content-length'] = String(options.contentLength);
    } else if (Buffer.isBuffer(options.body)) {
      headers['content-length'] = String(options.body.length);
    }

    headers.authorization = this.buildAuth(method, canonicalUri, headers, payloadHash);

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
          if (method === 'GET' && response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            resolve(response);
            return;
          }

          const chunks: Buffer[] = [];
          response
            .on('data', (chunk) => chunks.push(Buffer.from(chunk)))
            .on('end', () => {
              const body = Buffer.concat(chunks).toString('utf8');
              if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
                resolve({ statusCode: response.statusCode, headers: response.headers, body });
                return;
              }
              const error = new MinioRequestError(body || `MinIO request failed with ${response.statusCode}`);
              error.statusCode = response.statusCode;
              error.body = body;
              reject(error);
            })
            .on('error', reject);
        },
      );

      request.on('error', reject);
      if (options.body && !Buffer.isBuffer(options.body)) {
        options.body.pipe(request);
      } else {
        request.end(options.body);
      }
    });
  }
}
