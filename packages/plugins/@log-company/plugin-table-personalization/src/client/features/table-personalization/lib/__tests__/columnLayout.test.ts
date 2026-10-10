/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import type { ColumnSettings, PersonalizableColumn } from '../../../../../shared/contracts';
import { applyColumnLayout, moveDraftColumn, normalizeDraft } from '../columnLayout';

const columns: PersonalizableColumn[] = [
  { uid: 'left', title: 'Слева', fieldPath: 'code', fixed: 'left' },
  { uid: 'first', title: 'Название', fieldPath: 'title', fixed: 'normal' },
  { uid: 'second', title: 'Название', fieldPath: 'title', fixed: 'normal' },
  { uid: 'right', title: 'Справа', fieldPath: 'status', fixed: 'right' },
];
const settings: ColumnSettings = {
  version: 1,
  columnOrder: ['second', 'right', 'left', 'first'],
  hiddenColumnUids: ['first'],
};

describe('personal column projection', () => {
  it('uses column UIDs and preserves fixed groups, service columns and renderer identity', () => {
    const render = () => 'clickable cell';
    const original = [
      { uid: 'actions', canPersonalize: false, props: { render, fixed: 'left' } },
      ...columns.map((column) => ({ uid: column.uid, canPersonalize: true, props: { render, fixed: column.fixed } })),
    ];
    const result = applyColumnLayout(original, settings);
    expect(result.map((column) => column.uid)).toEqual(['actions', 'left', 'second', 'right']);
    expect(result.every((column) => column.props.render === render)).toBe(true);
    expect(original.map((column) => column.uid)).toEqual(['actions', 'left', 'first', 'second', 'right']);
  });

  it('keeps globally hidden/forbidden columns hidden and adds new columns visibly', () => {
    const original = columns.map((column) => ({
      uid: column.uid,
      canPersonalize: column.uid !== 'first',
      props: { fixed: column.fixed, hidden: column.uid === 'first' },
    }));
    const result = applyColumnLayout(
      [...original, { uid: 'new', canPersonalize: true, props: { fixed: 'normal', hidden: false } }],
      settings,
    );
    expect(result.find((column) => column.uid === 'first')?.props.hidden).toBe(true);
    expect(result.find((column) => column.uid === 'new')?.props.hidden).toBe(false);
  });

  it('allows hiding every field while retaining service actions', () => {
    const original = columns.map((column) => ({ uid: column.uid, canPersonalize: true, props: {} }));
    expect(applyColumnLayout(original, { ...settings, hiddenColumnUids: columns.map((column) => column.uid) })).toEqual(
      [],
    );
  });

  it('moves drafts locally and disallows movement between fixed groups', () => {
    const draft = normalizeDraft(null, columns);
    expect(moveDraftColumn(draft, columns, 'first', 'second').columnOrder).toEqual([
      'left',
      'second',
      'first',
      'right',
    ]);
    expect(moveDraftColumn(draft, columns, 'first', 'right')).toBe(draft);
    expect(draft.columnOrder).toEqual(['left', 'first', 'second', 'right']);
  });

  it('drops removed columns and preserves hidden drafts on schema refresh', () => {
    expect(
      normalizeDraft(
        settings,
        columns.filter((column) => column.uid !== 'second'),
      ),
    ).toEqual({ version: 1, columnOrder: ['left', 'first', 'right'], hiddenColumnUids: ['first'] });
  });

  it('offers unconfigured collection fields unchecked and retains their explicit selection', () => {
    const catalog: PersonalizableColumn[] = [
      ...columns,
      { uid: 'extra', title: 'Другое поле', fieldPath: 'extra', fixed: 'normal', source: 'collection' },
    ];
    expect(normalizeDraft(null, catalog).hiddenColumnUids).toEqual(['extra']);
    expect(normalizeDraft(settings, catalog).hiddenColumnUids).toEqual(['first', 'extra']);
    expect(
      normalizeDraft({ ...settings, columnOrder: [...settings.columnOrder, 'extra'] }, catalog).hiddenColumnUids,
    ).toEqual(['first']);
  });
});
