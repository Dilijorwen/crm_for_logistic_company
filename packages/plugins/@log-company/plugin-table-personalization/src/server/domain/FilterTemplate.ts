/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { record } from '../../shared/contracts';
import type { FilterCondition, FilterValue, SavedFilter } from '../../shared/filterTemplates';
import { FilterTemplateError } from './FilterTemplateError';

export const MAX_TEMPLATE_NAME = 100;
export const MAX_FILTER_NODES = 100;
export const MAX_FILTER_DEPTH = 10;
export const MAX_FILTER_LENGTH = 65536;
const UNSAFE_KEYS = ['__proto__', 'prototype', 'constructor'];

export function invalidTemplate(): never {
  throw new FilterTemplateError('INVALID_TEMPLATE');
}

export function parseTemplateName(value: unknown): string {
  if (typeof value !== 'string') return invalidTemplate();
  const name = value.trim();
  if (!name || name.length > MAX_TEMPLATE_NAME || /\p{Cc}/u.test(name)) return invalidTemplate();
  return name;
}

export function parseTemplateId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) return invalidTemplate();
  return value;
}

export function parseRevision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) return invalidTemplate();
  return value;
}

function jsonValue(value: unknown, depth = 0): FilterValue {
  if (depth > MAX_FILTER_DEPTH) return invalidTemplate();
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((entry) => jsonValue(entry, depth + 1));
  if (!value || typeof value !== 'object') return invalidTemplate();
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (UNSAFE_KEYS.includes(key)) return invalidTemplate();
      return [key, jsonValue(entry, depth + 1)];
    }),
  );
}

export function parseSavedFilter(value: unknown): SavedFilter {
  // Bound the input before recursive traversal, including large arrays of condition values.
  try {
    const serialized = JSON.stringify(value);
    if (!serialized || serialized.length > MAX_FILTER_LENGTH) return invalidTemplate();
  } catch {
    return invalidTemplate();
  }
  let nodes = 0;
  function group(input: unknown, depth: number): SavedFilter {
    if (++nodes > MAX_FILTER_NODES || depth > MAX_FILTER_DEPTH) return invalidTemplate();
    const data = record(input);
    if (
      Object.keys(data).some((key) => !['logic', 'items'].includes(key)) ||
      !['$and', '$or'].includes(String(data.logic)) ||
      !Array.isArray(data.items)
    )
      return invalidTemplate();
    const logic = data.logic as SavedFilter['logic'];
    return {
      logic,
      items: data.items.map((item): SavedFilter | FilterCondition => {
        const condition = record(item);
        if ('logic' in condition || 'items' in condition) return group(item, depth + 1);
        if (++nodes > MAX_FILTER_NODES) return invalidTemplate();
        if (
          Object.keys(condition).some((key) => !['path', 'operator', 'value', 'noValue'].includes(key)) ||
          typeof condition.path !== 'string' ||
          condition.path.length > 512 ||
          !/^[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)*$/u.test(condition.path) ||
          condition.path.split('.').some((key) => UNSAFE_KEYS.includes(key)) ||
          typeof condition.operator !== 'string' ||
          !/^\$[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(condition.operator) ||
          ['\u0024sql', '\u0024raw'].includes(condition.operator) ||
          ('noValue' in condition && typeof condition.noValue !== 'boolean') ||
          (!('value' in condition) && condition.noValue !== true)
        )
          return invalidTemplate();
        return {
          path: condition.path,
          operator: condition.operator,
          ...('value' in condition ? { value: jsonValue(condition.value) } : {}),
          ...('noValue' in condition ? { noValue: condition.noValue as boolean } : {}),
        };
      }),
    };
  }
  return group(value, 0);
}

export function filterPaths(filter: SavedFilter): string[] {
  return filter.items.flatMap((item) => ('items' in item ? filterPaths(item) : [item.path]));
}
