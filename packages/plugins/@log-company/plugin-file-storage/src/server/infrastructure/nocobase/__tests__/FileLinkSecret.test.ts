/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readOrCreateFileLinkSecret } from '../FileLinkSecret';

const files = vi.hoisted(() => ({ readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn() }));
vi.mock('fs/promises', () => ({ default: files }));

beforeEach(() => {
  vi.resetAllMocks();
  files.mkdir.mockResolvedValue(undefined);
  files.writeFile.mockResolvedValue(undefined);
});

describe('FileLinkSecret', () => {
  it('reuses a persistent private key without changing it', async () => {
    files.readFile.mockResolvedValue(Buffer.alloc(32, 7));
    expect(await readOrCreateFileLinkSecret('main')).toBe(Buffer.alloc(32, 7).toString('hex'));
    expect(files.writeFile).not.toHaveBeenCalled();
  });

  it('creates a random 256-bit key with owner-only permissions', async () => {
    files.readFile.mockRejectedValueOnce({ code: 'ENOENT' }).mockResolvedValueOnce(Buffer.alloc(32, 7));
    await readOrCreateFileLinkSecret('main');
    expect(files.writeFile.mock.calls[0][1]).toHaveLength(32);
    expect(files.writeFile.mock.calls[0][2]).toEqual({ flag: 'wx', mode: 0o600 });
  });

  it('handles simultaneous first startup without overwriting another key', async () => {
    files.readFile.mockRejectedValueOnce({ code: 'ENOENT' }).mockResolvedValueOnce(Buffer.alloc(32, 8));
    files.writeFile.mockRejectedValue({ code: 'EEXIST' });
    expect(await readOrCreateFileLinkSecret('main')).toBe(Buffer.alloc(32, 8).toString('hex'));
  });

  it('fails closed for an invalid key or application path', async () => {
    files.readFile.mockResolvedValue(Buffer.alloc(5));
    await expect(readOrCreateFileLinkSecret('main')).rejects.toThrow('Недопустимый ключ');
    await expect(readOrCreateFileLinkSecret('../other')).rejects.toThrow();
    expect(files.writeFile).not.toHaveBeenCalled();
  });
});
