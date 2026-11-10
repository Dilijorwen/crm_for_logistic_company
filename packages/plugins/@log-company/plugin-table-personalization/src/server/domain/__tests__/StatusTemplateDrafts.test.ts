/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { MAX_FILTER_LENGTH, MAX_TEMPLATE_NAME } from '../FilterTemplate';
import { statusTemplateDrafts } from '../StatusTemplateDrafts';

describe('status template drafts', () => {
  it('uses a readable status code and the initial column layout', () => {
    expect(
      statusTemplateDrafts(
        [{ label: '  В очереди ', value: 'queue' }],
        [
          { uid: 'status', title: 'Статус', fieldPath: 'status', fixed: 'normal' },
          { uid: 'extra', title: 'Детали', fieldPath: 'extra', fixed: 'normal', source: 'collection' },
        ],
      ),
    ).toEqual([
      {
        name: 'В очереди',
        filter: { logic: '$and', items: [{ path: 'status', operator: '$eq', value: 'queue' }] },
        columnSettings: { version: 1, columnOrder: ['status', 'extra'], hiddenColumnUids: ['extra'] },
      },
    ]);
  });

  it('skips duplicate names and values, invalid labels and oversized filters', () => {
    const label = 'и'.repeat(MAX_TEMPLATE_NAME);
    expect(
      statusTemplateDrafts(
        [
          { label, value: 0 },
          { label, value: 'duplicate-name' },
          { label: 'Дубликат', value: 0 },
          { label: 'x'.repeat(MAX_TEMPLATE_NAME + 1), value: 1 },
          { label: '', value: 2 },
          { label: 'Слишком длинный код', value: 'x'.repeat(MAX_FILTER_LENGTH) },
        ],
        [],
      ),
    ).toMatchObject([{ name: label, filter: { items: [{ value: 0 }] } }]);
  });
});
