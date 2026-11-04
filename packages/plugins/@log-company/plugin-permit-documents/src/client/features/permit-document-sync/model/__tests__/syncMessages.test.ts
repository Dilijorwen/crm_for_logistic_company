/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { syncRequestErrorMessage, syncResultMessage } from '../syncMessages';
import { registryErrorMessage, registryErrorMessages } from '../../../../../contracts/permitDocumentMessages';

describe('permit document check messages', () => {
  it.each(Object.keys(registryErrorMessages))('explains stored %s in Russian', (code) => {
    expect(registryErrorMessage(code)).toMatch(/[А-Яа-я]/);
    expect(registryErrorMessage(code)).not.toContain(code);
    expect(syncResultMessage({ data: { syncStatus: 'ERROR', errorCode: code } })).toEqual({
      type: 'error',
      message: registryErrorMessage(code),
    });
  });
  it('handles success, not found, manual category and nested response data', () => {
    expect(syncResultMessage({ data: { data: { syncStatus: 'SUCCESS' } } }).type).toBe('success');
    expect(syncResultMessage({ data: { syncStatus: 'NOT_FOUND' } }).type).toBe('warning');
    expect(syncResultMessage({ data: { syncStatus: 'NOT_REQUIRED' } }).type).toBe('info');
  });
  it('never reports success for a missing or malformed result and never exposes unexpected payloads', () => {
    for (const response of [
      undefined,
      { data: '<html>Internal SQL password</html>' },
      { data: { syncStatus: 'OTHER', message: 'secret' } },
    ]) {
      const result = syncResultMessage(response);
      expect(result.type).toBe('error');
      expect(result.message).not.toMatch(/secret|password|SQL/);
    }
    expect(registryErrorMessage('__proto__')).toBe(registryErrorMessages.INTERNAL_SYNC_ERROR);
  });
  it.each([401, 403, 404, 409, 422, 500, 503])('safely explains HTTP %s', (status) => {
    const message = syncRequestErrorMessage({ response: { status, data: { errors: [{ message: 'SQL secret' }] } } });
    expect(message).toMatch(/[А-Яа-я]/);
    expect(message).not.toContain('SQL');
  });
  it('explains a lost connection', () =>
    expect(syncRequestErrorMessage({ code: 'ERR_NETWORK' })).toContain('подключение'));
});
