/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { resolveFileTypeDetector } from '../file-type-detector';

describe('file-type API compatibility', () => {
  const result = { ext: 'png', mime: 'image/png' };

  it.each([
    ['modern ESM', (detect: () => Promise<typeof result>) => ({ fileTypeFromBuffer: detect })],
    ['CommonJS fromBuffer', (detect: () => Promise<typeof result>) => ({ default: { fromBuffer: detect } })],
    ['named fromBuffer', (detect: () => Promise<typeof result>) => ({ fromBuffer: detect })],
    ['nested ESM', (detect: () => Promise<typeof result>) => ({ default: { fileTypeFromBuffer: detect } })],
    ['legacy CommonJS function', (detect: () => Promise<typeof result>) => ({ default: detect })],
    ['legacy direct function', (detect: () => Promise<typeof result>) => detect],
  ])('detects a file through %s', async (_name, makeModule) => {
    const detect = vi.fn().mockResolvedValue(result);
    expect(await resolveFileTypeDetector(makeModule(detect))(new Uint8Array([1, 2, 3]))).toEqual(result);
    expect(Buffer.isBuffer(detect.mock.calls[0][0])).toBe(true);
  });

  it('preserves an undetected file for the existing MIME fallback', async () => {
    expect(await resolveFileTypeDetector({ default: () => undefined })(new Uint8Array())).toBeUndefined();
  });

  it('does not silently disable detection when no supported API exists', () => {
    expect(() => resolveFileTypeDetector({})).toThrow('File type detection API is unavailable');
  });

  it('propagates detector failures', async () => {
    const error = new Error('Unreadable header');
    const detect = vi.fn().mockRejectedValue(error);
    await expect(resolveFileTypeDetector({ fileTypeFromBuffer: detect })(new Uint8Array())).rejects.toBe(error);
  });
});
