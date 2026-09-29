/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { CollectionSearchError } from './SearchErrors';

export const MIN_SEARCH_TERM_LENGTH = 3;
export const MAX_SEARCH_TERM_LENGTH = 100;

export type SearchableFieldKind = 'text' | 'number' | 'date' | 'boolean';

export type SearchPrimitive = string | number | boolean | null;

export interface SearchableField {
  name: string;
  title: string;
  kind: SearchableFieldKind;
  path?: string[];
  enum?: Array<{ value: SearchPrimitive; label: string }>;
}

export interface SearchFieldValue {
  display: string;
  searchText: string;
  raw: SearchPrimitive;
}

export interface SearchDocument {
  values: Record<string, SearchFieldValue>;
  searchText: string;
}

function valuesAtPath(value: unknown, path: string[]): unknown[] {
  if (!path.length) {
    return Array.isArray(value) ? value.flatMap((item) => valuesAtPath(item, [])) : [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => valuesAtPath(item, path));
  }
  if (!value || typeof value !== 'object') {
    return [];
  }
  const [head, ...tail] = path;
  return valuesAtPath((value as Record<string, unknown>)[head], tail);
}

export function normalizeSearchTerm(value: unknown): string {
  if (typeof value !== 'string') {
    throw new CollectionSearchError('SEARCH_TERM_TOO_SHORT', 'Search term must be a string.');
  }
  const term = value.trim().replace(/\s+/g, ' ');
  if (term.length < MIN_SEARCH_TERM_LENGTH) {
    throw new CollectionSearchError(
      'SEARCH_TERM_TOO_SHORT',
      `Search term must contain at least ${MIN_SEARCH_TERM_LENGTH} characters.`,
    );
  }
  if (term.length > MAX_SEARCH_TERM_LENGTH) {
    throw new CollectionSearchError(
      'SEARCH_TERM_TOO_LONG',
      `Search term must contain no more than ${MAX_SEARCH_TERM_LENGTH} characters.`,
    );
  }
  return term;
}

function formatDate(value: unknown): SearchFieldValue | null {
  if (value === null || value === '') {
    return null;
  }
  const date = new Date(String(value));
  const raw = value instanceof Date ? value.toISOString() : (value as SearchPrimitive);
  if (Number.isNaN(date.getTime())) {
    return {
      raw,
      display: String(value),
      searchText: String(value),
    };
  }
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const display = `${day}.${month}.${year}`;
  return {
    raw,
    display,
    searchText: `${year}-${month}-${day} ${display} ${day}/${month}/${year} ${day} ${month} ${year}`,
  };
}

function enumLabel(field: SearchableField, value: SearchPrimitive): string | undefined {
  return field.enum?.find((item) => String(item.value) === String(value))?.label;
}

export function formatSearchFieldValue(field: SearchableField, value: unknown): SearchFieldValue | null {
  if (value === undefined || value === null || Array.isArray(value)) {
    return null;
  }
  if (field.kind === 'date') {
    return formatDate(value);
  }
  if (typeof value === 'object') {
    return null;
  }
  const primitive = value as SearchPrimitive;
  if (field.kind === 'boolean') {
    const booleanValue = primitive === true || primitive === 1 || primitive === 'true';
    return {
      raw: booleanValue,
      display: booleanValue ? 'true' : 'false',
      searchText: booleanValue ? 'true yes да 1' : 'false no нет 0',
    };
  }
  const rawValue = String(primitive);
  const label = enumLabel(field, primitive);
  return {
    raw: primitive,
    display: label || rawValue,
    searchText: label ? `${label} ${rawValue}` : rawValue,
  };
}

export function buildSearchDocument(record: Record<string, unknown>, fields: SearchableField[]): SearchDocument {
  const values: Record<string, SearchFieldValue> = {};
  const searchableValues: string[] = [];
  for (const field of fields) {
    const fieldValues = valuesAtPath(record, field.path || [field.name])
      .map((value) => formatSearchFieldValue(field, value))
      .filter((value): value is SearchFieldValue => Boolean(value));
    if (!fieldValues.length) {
      continue;
    }
    const uniqueSearchValues = Array.from(new Set(fieldValues.map((value) => value.searchText)));
    const uniqueDisplayValues = Array.from(new Set(fieldValues.map((value) => value.display)));
    values[field.name] =
      fieldValues.length === 1
        ? fieldValues[0]
        : {
            raw: uniqueDisplayValues.join(', '),
            display: uniqueDisplayValues.join(', '),
            searchText: uniqueSearchValues.join(' '),
          };
    searchableValues.push(...uniqueSearchValues);
  }
  return {
    values,
    searchText: searchableValues.join(' ').trim(),
  };
}
