/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type RouteLocationLike = Pick<Location, 'hash' | 'pathname' | 'search'>;

function getCurrentLocation(): RouteLocationLike | undefined {
  return typeof window === 'undefined' ? undefined : window.location;
}

function getLastNonEmptyValue(params: URLSearchParams, key: string) {
  const values = params.getAll(key);
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== '') {
      return values[index];
    }
  }
  return undefined;
}

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getPathRouteFilterByTkValues(location: RouteLocationLike | undefined = getCurrentLocation()) {
  if (!location) {
    return [];
  }

  const values: string[] = [];
  const pathSegments = location.pathname.split('/').filter(Boolean);
  for (let index = 0; index < pathSegments.length - 1; index += 1) {
    const segment = pathSegments[index].toLowerCase();
    if (segment === 'filterbytk' || segment === 'filter-by-tk' || segment === 'filterbytk[]') {
      const value = decodePathSegment(pathSegments[index + 1]);
      if (value !== '') {
        values.push(value);
      }
    }
  }
  return values;
}

/**
 * Returns the record key belonging to the innermost popup represented by the route.
 * NocoBase appends another `filterbytk/<key>` pair for each nested popup, so the
 * right-most pair is the current record and the left-most pair belongs to its parent.
 */
export function getInnermostRouteFilterByTk(location: RouteLocationLike | undefined = getCurrentLocation()) {
  if (!location) {
    return undefined;
  }

  const queryStrings = [location.search, location.hash.split('?')[1]].filter(Boolean);
  for (const queryString of queryStrings) {
    const params = new URLSearchParams(queryString.replace(/^\?/, ''));
    for (const key of ['filterByTk', 'filterByTk[]', 'id']) {
      const value = getLastNonEmptyValue(params, key);
      if (value !== undefined) {
        return value;
      }
    }
  }

  const pathValues = getPathRouteFilterByTkValues(location);
  return pathValues[pathValues.length - 1];
}
