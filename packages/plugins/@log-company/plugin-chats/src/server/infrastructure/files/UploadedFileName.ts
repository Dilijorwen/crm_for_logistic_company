/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

/**
 * Multipart parsers may expose UTF-8 filename bytes as a Latin-1 string.
 * Decode only a lossless UTF-8 round trip; keep Unicode and genuine Latin-1 names unchanged.
 */
export function decodeUploadedFileName(value: string): string {
  if (Array.from(value).some((character) => character.charCodeAt(0) > 0xff)) {
    return value;
  }

  const bytes = Buffer.from(value, 'latin1');
  const decoded = bytes.toString('utf8');
  return Buffer.from(decoded, 'utf8').equals(bytes) ? decoded : value;
}
