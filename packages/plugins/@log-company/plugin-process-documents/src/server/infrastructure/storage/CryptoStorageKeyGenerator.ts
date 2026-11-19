/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { generateFileKey } from '@log-company/plugin-file-storage';
import type { StorageKeyGenerator } from '../../application/ports/DocumentStorage';

export class CryptoStorageKeyGenerator implements StorageKeyGenerator {
  generate(ownerPath: string, originalFilename: string): string {
    return generateFileKey(ownerPath, originalFilename);
  }
}
