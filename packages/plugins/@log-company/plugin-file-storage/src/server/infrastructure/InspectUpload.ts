/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import fs from 'node:fs/promises';
import {
  InvalidUploadError,
  validateUploadBatch,
  validateUploadName,
  validateUploadSample,
} from '../domain/UploadPolicy';

type UploadProfile = Parameters<typeof validateUploadName>[1];

export async function inspectUpload(
  input: { path: string; originalName: string; size: number },
  profile: UploadProfile,
): Promise<string> {
  const filename = validateUploadName(input.originalName, profile);
  validateUploadBatch([input], profile);
  const file = await fs.open(input.path, 'r');
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size !== input.size) throw new InvalidUploadError('Размер принятого файла изменился.');
    const buffer = Buffer.alloc(1024);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    const sample = buffer.subarray(0, bytesRead);
    return validateUploadSample(filename, sample.toString('hex'), sample.includes(0), profile);
  } finally {
    await file.close();
  }
}
