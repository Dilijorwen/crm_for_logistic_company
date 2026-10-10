/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import crypto from 'crypto';
import type { FileLinkVerifier } from '../../application/ports/StoredAttachmentAccess';
import { signFileLink } from './SignedFileLink';

export class SignedFileLinkVerifier implements FileLinkVerifier {
  constructor(
    private readonly secret: string,
    private readonly application: string,
  ) {}

  verify(id: string, expires: unknown, signature: unknown): boolean {
    const expiry = Number(expires);
    const now = Math.floor(Date.now() / 1000);
    if (
      !Number.isSafeInteger(expiry) ||
      expiry < now ||
      expiry > now + 300 ||
      typeof signature !== 'string' ||
      !/^[a-f0-9]{64}$/.test(signature)
    )
      return false;
    const expected = signFileLink(id, expiry, this.secret, this.application);
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  }
}
