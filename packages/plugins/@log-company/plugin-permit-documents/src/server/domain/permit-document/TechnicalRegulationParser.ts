/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { EaeuTechnicalRegulationReference } from './RegistryDocument';

const TECHNICAL_REGULATION_PATTERN = /ТР\s+(?:ТС|ЕАЭС)\s+\d{1,3}\s*\/\s*\d{4}/giu;

export function parseEaeuTechnicalRegulations(values: readonly string[]): EaeuTechnicalRegulationReference[] {
  const regulations = new Map<string, EaeuTechnicalRegulationReference>();
  for (const value of values) {
    const matches = Array.from(value.matchAll(TECHNICAL_REGULATION_PATTERN));
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const docNum = normalizeDocNum(match[0]);
      const previousMatchEnd = index === 0 ? 0 : (matches[index - 1].index || 0) + matches[index - 1][0].length;
      const nameStart = (match.index || 0) + match[0].length;
      const nameEnd = matches[index + 1]?.index ?? value.length;
      const precedingValue = value.slice(previousMatchEnd, match.index || 0);
      const precedingName = /\(\s*$/u.test(precedingValue) ? quotedName(precedingValue) : null;
      const name = precedingName || normalizeName(value.slice(nameStart, nameEnd));
      const current = regulations.get(docNum);
      if (!current || (current.name === null && name !== null)) {
        regulations.set(docNum, { source: 'EAEU', docNum, name });
      }
    }
  }
  return Array.from(regulations.values());
}

function quotedName(value: string): string | null {
  const matches = Array.from(value.matchAll(/[«"“]([^»"”]+)[»"”]/gu));
  return matches.length > 0 ? normalizeName(matches[matches.length - 1][1]) : null;
}

function normalizeDocNum(value: string): string {
  return value
    .toLocaleUpperCase('ru-RU')
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .trim();
}

function normalizeName(value: string): string | null {
  const normalized = value
    .replace(/^[\s\-–—:;,.'"«»“”()]+/u, '')
    .replace(/[\s\-–—:;,.'"«»“”()]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length > 0 ? normalized : null;
}
