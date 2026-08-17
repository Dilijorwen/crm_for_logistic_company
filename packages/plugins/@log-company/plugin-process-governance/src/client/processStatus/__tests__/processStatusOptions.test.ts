/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { PROCESS_STATUS_ROLE_NAMES } from '../../../shared/processStatusPermissions';
import { isProcessStatusReadOnly, restrictProcessStatusOptions } from '../processStatusOptions';

const options = [
  { value: 'queue', label: 'В очереди' },
  { value: 'in_russia', label: 'В РФ' },
  { value: 'warehouse', label: 'Склад' },
];

describe('process status client options', () => {
  it('disables declarant-only statuses for a manager without removing their labels', () => {
    expect(restrictProcessStatusOptions(options, [PROCESS_STATUS_ROLE_NAMES.manager])).toEqual([
      { value: 'queue', label: 'В очереди', disabled: false },
      { value: 'in_russia', label: 'В РФ', disabled: false },
      { value: 'warehouse', label: 'Склад', disabled: true },
    ]);
  });

  it('disables manager-only statuses for a declarant and keeps Russia enabled', () => {
    expect(restrictProcessStatusOptions(options, [PROCESS_STATUS_ROLE_NAMES.declarantIntern])).toEqual([
      { value: 'queue', label: 'В очереди', disabled: true },
      { value: 'in_russia', label: 'В РФ', disabled: false },
      { value: 'warehouse', label: 'Склад', disabled: false },
    ]);
  });

  it('marks unrelated roles as read-only', () => {
    expect(isProcessStatusReadOnly(['financier'])).toBe(true);
    expect(isProcessStatusReadOnly([PROCESS_STATUS_ROLE_NAMES.managerIntern])).toBe(false);
  });
});
