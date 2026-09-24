/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { LogisticsError } from './LogisticsError';

const MIN_REGISTRATION_NUMBER_LENGTH = 2;
const MAX_REGISTRATION_NUMBER_LENGTH = 32;
const CYRILLIC_LOOKALIKE_TO_LATIN: Readonly<Record<string, string>> = {
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  У: 'Y',
  Х: 'X',
};

export function normalizeVehicleRegistrationNumber(value: unknown): string {
  if (typeof value !== 'string') {
    throw new LogisticsError('INVALID_REGISTRATION_NUMBER', 'Укажите номер машины.');
  }

  const normalized = Array.from(value.normalize('NFKC').trim().toUpperCase())
    .map((character) => CYRILLIC_LOOKALIKE_TO_LATIN[character] ?? character)
    .join('')
    .replace(/[\s-]+/g, '');

  if (
    normalized.length < MIN_REGISTRATION_NUMBER_LENGTH ||
    normalized.length > MAX_REGISTRATION_NUMBER_LENGTH ||
    !/^[A-Z0-9]+$/.test(normalized)
  ) {
    throw new LogisticsError(
      'INVALID_REGISTRATION_NUMBER',
      'Номер машины должен содержать от 2 до 32 латинских букв или цифр.',
    );
  }

  return normalized;
}
