/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { PROCESS_STATUS_ROLE_NAMES } from '../../../../shared/processStatusPermissions';
import { ProcessGovernanceError } from '../ProcessGovernanceError';
import { assertProcessStatusChangeAllowed } from '../ProcessStatusPolicy';

const knownStatusValues = ['queue', 'in_work', 'knr', 'in_russia', 'warehouse', 'release'];

function statusChange(overrides: Partial<Parameters<typeof assertProcessStatusChangeAllowed>[0]> = {}) {
  return {
    roleNames: [PROCESS_STATUS_ROLE_NAMES.manager],
    currentStatus: 'queue',
    requestedStatus: 'in_work',
    isExistingProcess: true,
    knownStatusValues,
    ...overrides,
  };
}

describe('assertProcessStatusChangeAllowed', () => {
  it('allows a manager status transition', () => {
    expect(() => assertProcessStatusChangeAllowed(statusChange())).not.toThrow();
  });

  it('allows an unchanged status for a read-only role', () => {
    expect(() =>
      assertProcessStatusChangeAllowed(
        statusChange({ roleNames: ['accountant'], currentStatus: 'queue', requestedStatus: 'queue' }),
      ),
    ).not.toThrow();
  });

  it('rejects a manager transition to a declarant status', () => {
    expect(() => assertProcessStatusChangeAllowed(statusChange({ requestedStatus: 'warehouse' }))).toThrowError(
      expect.objectContaining<Partial<ProcessGovernanceError>>({ code: 'PROCESS_STATUS_FORBIDDEN' }),
    );
  });

  it('rejects an unknown status even for a declarant', () => {
    expect(() =>
      assertProcessStatusChangeAllowed(
        statusChange({ roleNames: [PROCESS_STATUS_ROLE_NAMES.declarant], requestedStatus: 'unknown' }),
      ),
    ).toThrowError(expect.objectContaining<Partial<ProcessGovernanceError>>({ code: 'PROCESS_STATUS_INVALID' }));
  });

  it('rejects clearing the status', () => {
    expect(() => assertProcessStatusChangeAllowed(statusChange({ requestedStatus: null }))).toThrowError(
      expect.objectContaining<Partial<ProcessGovernanceError>>({ code: 'PROCESS_STATUS_INVALID' }),
    );
  });
});
