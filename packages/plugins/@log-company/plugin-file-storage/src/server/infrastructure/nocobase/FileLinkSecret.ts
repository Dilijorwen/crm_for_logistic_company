/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { storageAreaPrefix } from '../../domain/StorageKey';

export async function readOrCreateFileLinkSecret(application: string): Promise<string> {
  storageAreaPrefix(application, 'attachments');
  const filename = path.resolve('storage', 'apps', application, 'file_storage_secret.dat');
  const read = async (): Promise<string> => {
    const secret = await fs.readFile(filename);
    if (secret.length !== 32) throw new Error('Недопустимый ключ подписанных файловых ссылок.');
    return secret.toString('hex');
  };
  try {
    return await read();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await fs.mkdir(path.dirname(filename), { recursive: true });
  try {
    await fs.writeFile(filename, crypto.randomBytes(32), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  return read();
}
