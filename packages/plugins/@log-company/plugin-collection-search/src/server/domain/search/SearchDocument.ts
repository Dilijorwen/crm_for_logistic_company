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
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export type SearchableFieldKind = 'text' | 'number' | 'date' | 'boolean';

export type SearchPrimitive = string | number | boolean | null;

export interface SearchableField {
  name: string;
  title: string;
  kind: SearchableFieldKind;
  enum?: Array<{ value: SearchPrimitive; label: string }>;
}

export interface SearchFieldValue {
  display: string;
  searchText: string;
  raw: SearchPrimitive;
}

export interface SearchMatch {
  fieldName: string;
  fieldTitle: string;
  value: string;
  rawValue: SearchPrimitive;
  score: number;
}

export interface SearchDocument {
  values: Record<string, SearchFieldValue>;
  searchText: string;
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

export function normalizePageSize(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_PAGE_SIZE;
  }
  const pageSize = Number(value);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new CollectionSearchError('INVALID_PAGE_SIZE', `Page size must be between 1 and ${MAX_PAGE_SIZE}.`);
  }
  return pageSize;
}

function normalizeComparable(value: string): string {
  return value.toLocaleLowerCase().normalize('NFKC');
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
    const fieldValue = formatSearchFieldValue(field, record[field.name]);
    if (!fieldValue) {
      continue;
    }
    values[field.name] = fieldValue;
    searchableValues.push(fieldValue.searchText);
  }
  return {
    values,
    searchText: searchableValues.join(' ').trim(),
  };
}

function matchScore(value: string, term: string): number {
  const comparableValue = normalizeComparable(value);
  const comparableTerm = normalizeComparable(term);
  if (comparableValue === comparableTerm) {
    return 100;
  }
  if (comparableValue.startsWith(comparableTerm)) {
    return 50;
  }
  return comparableValue.includes(comparableTerm) ? 10 : 0;
}

export function findSearchMatches(
  record: Record<string, unknown>,
  fields: SearchableField[],
  term: string,
): SearchMatch[] {
  return fields
    .map((field): SearchMatch | null => {
      const fieldValue = formatSearchFieldValue(field, record[field.name]);
      if (!fieldValue) {
        return null;
      }
      const score = matchScore(fieldValue.searchText, term);
      if (!score) {
        return null;
      }
      return {
        fieldName: field.name,
        fieldTitle: field.title,
        value: fieldValue.display,
        rawValue: fieldValue.raw,
        score,
      };
    })
    .filter((match): match is SearchMatch => Boolean(match))
    .sort((left, right) => right.score - left.score || left.fieldTitle.localeCompare(right.fieldTitle));
}
