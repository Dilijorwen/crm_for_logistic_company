/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Readable } from 'node:stream';
import type { Context, Next } from '@nocobase/actions';
import type { Plugin } from '@nocobase/server';
import { describe, expect, it, vi } from 'vitest';
import { OpenStoredAttachment } from '../../application/OpenStoredAttachment';
import { FileStorageController } from '../FileStorageController';

function fixture() {
  const define = vi.fn();
  const plugin = {
    app: { resourceManager: { define }, acl: { allow: vi.fn() } },
    log: { error: vi.fn() },
  } as unknown as Plugin;
  const repository = {
    find: vi.fn().mockResolvedValue({ key: 'key', fileName: 'Документ.txt', mimeType: 'text/plain' }),
  };
  const links = { verify: vi.fn().mockReturnValue(true) };
  async function* bytes(): AsyncIterable<Uint8Array> {
    yield new TextEncoder().encode('Документ');
  }
  const storage = { open: vi.fn().mockResolvedValue(bytes()) };
  new FileStorageController(plugin, new OpenStoredAttachment(repository, links, storage)).register();
  const action = define.mock.calls[0][0].actions.open as (context: Context, next: Next) => Promise<void>;
  const headers = new Map<string, string>();
  const context = {
    action: { params: { id: '1', expires: 123, signature: 'valid' } },
    set: (name: string, value: string) => headers.set(name, value),
    throw: (status: number, message: string): never => {
      throw Object.assign(new Error(message), { status });
    },
  } as unknown as Context;
  return { action, context, headers, repository, links, storage };
}

describe('file delivery adapter', () => {
  it('converts the application byte stream to a Koa-compatible Node stream', async () => {
    const test = fixture();
    await test.action(test.context, async () => undefined);
    expect(test.context.body).toBeInstanceOf(Readable);
    const chunks: Uint8Array[] = [];
    for await (const chunk of test.context.body as AsyncIterable<Uint8Array>) chunks.push(chunk);
    expect(Buffer.concat(chunks).toString('utf8')).toBe('Документ');
    expect(test.headers.get('Content-Type')).toBe('text/plain');
    expect(test.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(test.headers.get('Content-Disposition')).toContain(encodeURIComponent('Документ.txt'));
  });

  it('rejects invalid capabilities before opening storage', async () => {
    const test = fixture();
    test.links.verify.mockReturnValue(false);
    await expect(test.action(test.context, async () => undefined)).rejects.toMatchObject({ status: 403 });
    expect(test.storage.open).not.toHaveBeenCalled();
  });

  it('preserves the missing-file HTTP contract', async () => {
    const test = fixture();
    test.repository.find.mockResolvedValue(null);
    await expect(test.action(test.context, async () => undefined)).rejects.toMatchObject({ status: 404 });
  });
});
