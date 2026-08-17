/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const PASSWORD_SPECIAL_CHARACTERS = '!@#$%^&*()-_=+[]{};:\'",.<>/?\\|`~';

export function satisfiesPasswordPolicy(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  return (
    value.length >= PASSWORD_MIN_LENGTH &&
    value.length <= PASSWORD_MAX_LENGTH &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    [...value].some((character) => PASSWORD_SPECIAL_CHARACTERS.includes(character)) &&
    !/\s/.test(value)
  );
}
