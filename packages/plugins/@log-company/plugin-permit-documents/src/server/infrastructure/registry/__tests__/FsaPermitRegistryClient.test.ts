/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import type { JsonHttpRequest, JsonHttpResponse, JsonHttpTransport } from '../../http/JsonHttpTransport';
import { FsaAuthTokenProvider } from '../FsaAuthTokenProvider';
import { FsaPermitRegistryClient } from '../FsaPermitRegistryClient';
import { FsaResponseParser } from '../FsaResponseParser';

class FakeTransport implements JsonHttpTransport {
  readonly requests: JsonHttpRequest[] = [];

  constructor(private readonly responses: JsonHttpResponse[]) {}

  async request(request: JsonHttpRequest): Promise<JsonHttpResponse> {
    this.requests.push(request);
    const response = this.responses.shift();
    if (!response) {
      throw new Error('No fake response configured.');
    }
    return response;
  }
}

function token(subject: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: subject, exp: Math.floor(Date.now() / 1_000) + 3_600 })).toString(
    'base64url',
  );
  return `${header}.${payload}.signature`;
}

const response = (status: number, body: unknown, authorization?: string): JsonHttpResponse => ({
  status,
  body,
  headers: authorization ? { authorization } : {},
});

describe('FsaPermitRegistryClient', () => {
  it('logs in dynamically, refreshes after 401 and sends the new Bearer token', async () => {
    const firstToken = token('first');
    const secondToken = token('second');
    const transport = new FakeTransport([
      response(200, null, `Bearer ${firstToken}`),
      response(401, null),
      response(200, null, `Bearer ${secondToken}`),
      response(200, { items: [{ id: 7, number: 'DOC-7' }] }),
      response(200, {
        idDeclaration: 7,
        idStatus: 6,
        number: 'DOC-7',
        declRegDate: '2026-08-01',
        declEndDate: '2027-08-01',
        idTechnicalReglaments: [],
        product: { identifications: [{ name: 'Product' }] },
      }),
    ]);
    const auth = new FsaAuthTokenProvider(transport, 'https://fsa.test', 'user', 'password');
    const client = new FsaPermitRegistryClient(transport, auth, new FsaResponseParser(), 'https://fsa.test');

    await expect(client.findByTitle('declaration_of_conformity', 'DOC-7')).resolves.toMatchObject({ externalId: '7' });
    expect(transport.requests.filter((request) => request.url.endsWith('/login'))).toHaveLength(2);
    expect(transport.requests[3].headers?.Authorization).toBe(`Bearer ${secondToken}`);
    expect(transport.requests[4].headers?.Authorization).toBe(`Bearer ${secondToken}`);
  });

  it('checks a status from the search response without loading the full card', async () => {
    const bearerToken = token('status');
    const transport = new FakeTransport([
      response(200, null, `Bearer ${bearerToken}`),
      response(200, { items: [{ id: 7, idStatus: 15, number: 'DOC-7' }] }),
    ]);
    const auth = new FsaAuthTokenProvider(transport, 'https://fsa.test', 'user', 'password');
    const client = new FsaPermitRegistryClient(transport, auth, new FsaResponseParser(), 'https://fsa.test');

    await expect(client.findStatusByTitle('declaration_of_conformity', 'DOC-7')).resolves.toMatchObject({
      externalId: '7',
      status: 'suspended',
    });
    expect(transport.requests).toHaveLength(2);
    expect(transport.requests[1].url).toBe('https://fsa.test/api/v1/rds/common/declarations/get');
  });

  it('fails safely when credentials are not configured', async () => {
    const auth = new FsaAuthTokenProvider(new FakeTransport([]), 'https://fsa.test', '', '');
    await expect(auth.getToken()).rejects.toMatchObject({ code: 'REGISTRY_NOT_CONFIGURED' });
  });
});
