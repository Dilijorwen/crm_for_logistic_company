/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { signFileLink } from '../SignedFileLink';
import { SignedFileLinkVerifier } from '../SignedFileLinkVerifier';

afterEach(() => {
  vi.useRealTimers();
});

describe('signed attachment links', () => {
  const verifier = new SignedFileLinkVerifier('test-secret', 'main');
  const expiry = 1_800_000_300;

  it('accepts a signed link at its maximum lifetime', () => {
    vi.useFakeTimers().setSystemTime(1_800_000_000_000);
    expect(verifier.verify('1', expiry, signFileLink('1', expiry, 'test-secret', 'main'))).toBe(true);
  });

  it('rejects expired, excessively long, malformed or modified links', () => {
    vi.useFakeTimers().setSystemTime(1_800_000_000_000);
    const signature = signFileLink('1', expiry, 'test-secret', 'main');
    expect(verifier.verify('2', expiry, signature)).toBe(false);
    expect(verifier.verify('1', 1_799_999_999, signature)).toBe(false);
    expect(verifier.verify('1', expiry + 1, signature)).toBe(false);
    expect(verifier.verify('1', expiry, 'invalid')).toBe(false);
    expect(new SignedFileLinkVerifier('test-secret', 'another-app').verify('1', expiry, signature)).toBe(false);
  });
});
