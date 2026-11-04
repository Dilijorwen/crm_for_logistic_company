/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { restoreColumnSettings } from '../RestoreColumnSettings';

const columns = ['first', 'second'].map((uid) => ({ uid, title: uid, fieldPath: uid, fixed: 'normal' as const }));

describe('restore complete column snapshots', () => {
  it('replaces accessible widths and preserves only opaque preferences', () => {
    const previous = {
      version: 1 as const,
      columnOrder: ['first', 'second', 'secret'],
      hiddenColumnUids: ['secret'],
      columnWidths: { first: 200, second: 300, secret: 400, deleted: 500 },
    };
    const submitted = {
      version: 1 as const,
      columnOrder: ['second', 'first'],
      hiddenColumnUids: ['first'],
      columnWidths: { second: 250 },
    };
    expect(
      restoreColumnSettings(submitted, previous, columns, ['first', 'second', 'secret'], ['first', 'second']),
    ).toEqual({
      version: 1,
      columnOrder: ['second', 'first', 'secret'],
      hiddenColumnUids: ['first', 'secret'],
      columnWidths: { second: 250, secret: 400 },
    });
  });

  it('restores automatic widths when the snapshot has no override', () => {
    const previous = {
      version: 1 as const,
      columnOrder: ['first', 'second'],
      hiddenColumnUids: [],
      columnWidths: { first: 320 },
    };
    expect(
      restoreColumnSettings(
        { ...previous, columnWidths: {} },
        previous,
        columns,
        ['first', 'second'],
        ['first', 'second'],
      ).columnWidths,
    ).toEqual({});
  });
});
