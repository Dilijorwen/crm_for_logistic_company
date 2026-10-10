/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import type { ColumnSettings, PersonalizableColumn } from '../../../shared/contracts';
import {
  effectiveSettings,
  MAX_COLUMNS,
  mergeSettings,
  parseIdentity,
  parseSettings,
  parseWidthChange,
} from '../ColumnPreferences';

const column = (uid: string): PersonalizableColumn => ({ uid, title: uid, fieldPath: uid, fixed: 'normal' });
const settings = (order: string[], hidden: string[] = []): ColumnSettings => ({
  version: 1,
  columnOrder: order,
  hiddenColumnUids: hidden,
});

describe('column preference invariants', () => {
  it('keeps version-one settings compatible and accepts bounded personal widths', () => {
    expect(parseSettings(settings(['first']))).not.toHaveProperty('columnWidths');
    expect(parseSettings({ ...settings(['first']), columnWidths: { first: 50, actions: 3000 } }).columnWidths).toEqual({
      first: 50,
      actions: 3000,
    });
    expect(parseWidthChange('first', null)).toEqual({ columnUid: 'first', width: null });
  });

  it.each([
    null,
    [],
    { first: 49 },
    { first: 3001 },
    { first: 150.5 },
    { first: '150' },
    { first: Infinity },
    { first: NaN },
    { '<script>': 150 },
    JSON.parse('{"__proto__":150}'),
    Object.fromEntries(Array.from({ length: MAX_COLUMNS + 1 }, (_, index) => [`col_${index}`, 150])),
  ])('rejects malformed widths %j', (columnWidths) => {
    expect(() => parseSettings({ ...settings([]), columnWidths })).toThrow('INVALID_SETTINGS');
  });

  it.each([
    ['first', undefined],
    ['first', -1],
    ['first', 1.5],
    ['first', '150'],
    ['constructor', 150],
  ])('rejects malformed width changes %s %s', (uid, width) => {
    expect(() => parseWidthChange(uid, width)).toThrow('INVALID_SETTINGS');
  });

  it('preserves opaque widths during layout changes and drops deleted columns', () => {
    const previous = {
      ...settings(['first', 'secret']),
      columnWidths: { first: 200, secret: 250, deleted: 300, actions: 180 },
    };
    const merged = mergeSettings(
      settings(['first']),
      previous,
      [column('first')],
      ['first', 'secret', 'actions'],
      ['first', 'actions'],
    );
    expect(merged.columnWidths).toEqual({ first: 200, secret: 250, actions: 180 });
    expect(effectiveSettings(merged, [column('first')], ['first', 'actions'])?.columnWidths).toEqual({
      first: 200,
      actions: 180,
    });
    expect(() =>
      mergeSettings(
        { ...settings(['first']), columnWidths: { secret: 150 } },
        previous,
        [column('first')],
        ['first', 'secret'],
      ),
    ).toThrow('FORBIDDEN');
  });
  it('accepts empty settings and the column count boundary', () => {
    expect(parseSettings(settings([]))).toEqual(settings([]));
    expect(
      parseSettings(settings(Array.from({ length: MAX_COLUMNS }, (_, index) => `column_${index}`))).columnOrder,
    ).toHaveLength(MAX_COLUMNS);
  });

  it.each([
    null,
    { ...settings([]), version: 2 },
    settings(['duplicate', 'duplicate']),
    settings(['valid'], ['unknown']),
    settings(['<script>']),
    { ...settings([]), userId: 'another-user' },
    settings(Array.from({ length: MAX_COLUMNS + 1 }, (_, index) => `column_${index}`)),
  ])('rejects malformed settings: %j', (value) => {
    expect(() => parseSettings(value)).toThrow('INVALID_SETTINGS');
  });

  it('validates identity without trusting a client instance key', () => {
    expect(parseIdentity({ tableUid: 'table', referencePath: ['outer', 'inner'] })).toEqual({
      tableUid: 'table',
      referencePath: ['outer', 'inner'],
    });
    expect(() => parseIdentity({ tableUid: 'table', referencePath: ['table'] })).toThrow('INVALID_SETTINGS');
    expect(() => parseIdentity({ tableUid: 'table', referencePath: [], instanceKey: 'forged' })).toThrow(
      'INVALID_SETTINGS',
    );
    expect(() =>
      parseIdentity({ tableUid: 'table', referencePath: Array.from({ length: 21 }, (_, index) => `ref_${index}`) }),
    ).toThrow('INVALID_SETTINGS');
  });

  it('keeps defaults without preferences and adds new columns visibly', () => {
    const columns = [column('second'), column('first'), column('new')];
    expect(effectiveSettings(null, columns)).toBeNull();
    expect(effectiveSettings(settings(['first', 'deleted', 'second'], ['first', 'deleted']), columns)).toEqual(
      settings(['first', 'second', 'new'], ['first']),
    );
  });

  it('preserves opaque preferences on role changes and prunes deleted columns on explicit save', () => {
    expect(
      mergeSettings(
        settings(['second', 'first']),
        settings(['first', 'restricted', 'second', 'deleted'], ['restricted', 'deleted']),
        [column('first'), column('second')],
        ['first', 'restricted', 'second'],
      ),
    ).toEqual(settings(['second', 'restricted', 'first'], ['restricted']));
  });

  it('preserves settings for runtime hidden columns outside the editable subset', () => {
    expect(
      mergeSettings(
        settings(['second'], ['second']),
        settings(['first', 'second'], ['first']),
        [column('first'), column('second')],
        ['first', 'second'],
      ),
    ).toEqual(settings(['first', 'second'], ['second', 'first']));
  });

  it('rejects configuring unknown or unauthorized columns', () => {
    expect(() => mergeSettings(settings(['restricted']), null, [column('first')], ['first', 'restricted'])).toThrow(
      'FORBIDDEN',
    );
  });

  it('keeps new collection fields hidden until explicitly selected, including older stored preferences', () => {
    const additional = { ...column('extra'), source: 'collection' as const };
    expect(effectiveSettings(settings(['first']), [column('first'), additional])).toEqual(
      settings(['first', 'extra'], ['extra']),
    );
    expect(effectiveSettings(settings(['first', 'extra']), [column('first'), additional])).toEqual(
      settings(['first', 'extra']),
    );
    expect(mergeSettings(settings(['first']), null, [column('first'), additional], ['first', 'extra'])).toEqual(
      settings(['first', 'extra'], ['extra']),
    );
  });
});
