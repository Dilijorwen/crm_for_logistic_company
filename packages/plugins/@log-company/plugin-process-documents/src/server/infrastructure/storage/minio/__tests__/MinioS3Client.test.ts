/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import http from 'http';
import { afterEach, describe, expect, it } from 'vitest';
import { MinioS3Client } from '../MinioS3Client';

let server: http.Server | undefined;

afterEach(async () => {
  if (!server) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    server?.close((error) => (error ? reject(error) : resolve()));
  });
  server = undefined;
});

async function listen(requestHandler: http.RequestListener): Promise<string> {
  server = http.createServer(requestHandler);
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test MinIO server did not expose a TCP address.');
  }
  return `http://127.0.0.1:${address.port}`;
}

describe('MinioS3Client.listObjects', () => {
  it('lists and decodes every page under the requested prefix', async () => {
    const requestedTokens: Array<string | null> = [];
    const endpoint = await listen((request, response) => {
      const requestUrl = new URL(request.url || '/', `http://${request.headers.host}`);
      expect(requestUrl.pathname).toBe('/documents');
      expect(requestUrl.searchParams.get('list-type')).toBe('2');
      expect(requestUrl.searchParams.get('encoding-type')).toBe('url');
      expect(requestUrl.searchParams.get('prefix')).toBe('processes/process-1/');
      requestedTokens.push(requestUrl.searchParams.get('continuation-token'));
      response.writeHead(200, { 'content-type': 'application/xml' });
      if (requestedTokens.length === 1) {
        response.end(`
          <ListBucketResult>
            <IsTruncated>true</IsTruncated>
            <NextContinuationToken>page&amp;2</NextContinuationToken>
            <Contents><Key>processes%2Fprocess-1%2Ffirst%20file.pdf</Key></Contents>
          </ListBucketResult>
        `);
        return;
      }
      response.end(`
        <ListBucketResult>
          <IsTruncated>false</IsTruncated>
          <Contents><Key>processes%2Fprocess-1%2Fsecond.pdf</Key></Contents>
        </ListBucketResult>
      `);
    });
    const client = new MinioS3Client({
      endpoint,
      region: 'us-east-1',
      accessKey: 'access-key',
      secretKey: 'secret-key',
      bucket: 'documents',
    });

    await expect(client.listObjects('processes/process-1/')).resolves.toEqual([
      'processes/process-1/first file.pdf',
      'processes/process-1/second.pdf',
    ]);
    expect(requestedTokens).toEqual([null, 'page&2']);
  });
});
