/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

interface DetectedFileType {
  ext: string;
  mime: string;
}

type BufferDetector = (buffer: Uint8Array) => DetectedFileType | undefined | Promise<DetectedFileType | undefined>;

function moduleExports(value: unknown): Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function')
    ? (value as Record<string, unknown>)
    : {};
}

// Full Docker images can provide a CommonJS detector; newer installs use the ESM API.
export function resolveFileTypeDetector(module: unknown): BufferDetector {
  const exported = moduleExports(module);
  const nested = moduleExports(exported.default);
  const detector = [
    exported.fileTypeFromBuffer,
    exported.fromBuffer,
    nested.fileTypeFromBuffer,
    nested.fromBuffer,
    exported.default,
    module,
  ].find((candidate) => typeof candidate === 'function');
  if (typeof detector !== 'function') {
    throw new Error('File type detection API is unavailable');
  }
  const detect = detector as BufferDetector;
  return (buffer) => detect(Buffer.from(buffer));
}

export async function detectFileTypeFromBuffer(buffer: Uint8Array): Promise<DetectedFileType | undefined> {
  return resolveFileTypeDetector(await import('file-type'))(buffer);
}
