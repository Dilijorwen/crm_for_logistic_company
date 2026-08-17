/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { getInnermostRouteFilterByTk, type RouteLocationLike } from '../getInnermostRouteFilterByTk';

function route(pathname: string, search = '', hash = ''): RouteLocationLike {
  return { pathname, search, hash };
}

describe('getInnermostRouteFilterByTk', () => {
  it('uses the current process key from the innermost nested popup', () => {
    const pathname =
      '/admin/3tni5pzosal/view/b9e7ada06b6/filterbytk/370463144542208/view/333c02fe621/' +
      'tab/ad77a1644da/filterbytk/379173154324480/sourceid/370463144542208';

    expect(getInnermostRouteFilterByTk(route(pathname))).toBe('379173154324480');
  });

  it('keeps the only popup key for a non-nested route', () => {
    expect(getInnermostRouteFilterByTk(route('/admin/view/record/filterbytk/370463144542208'))).toBe('370463144542208');
  });

  it('prefers an explicit query key and uses its last value', () => {
    expect(
      getInnermostRouteFilterByTk(route('/admin/view/filterbytk/parent', '?filterByTk=first&filterByTk=second')),
    ).toBe('second');
  });

  it('decodes a composite route key', () => {
    expect(getInnermostRouteFilterByTk(route('/admin/view/filter-by-tk/code%3D91%26year%3D2026'))).toBe(
      'code=91&year=2026',
    );
  });

  it('returns undefined when the route has no record key', () => {
    expect(getInnermostRouteFilterByTk(route('/admin/view'))).toBeUndefined();
  });
});
