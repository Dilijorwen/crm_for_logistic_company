/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

const INITIAL_PASSWORD_LENGTH = 10;

const UPPERCASE_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz';
const DIGIT_CHARACTERS = '0123456789';
const SPECIAL_CHARACTERS = '!#$%^&*-_+=';
const REQUIRED_CHARACTER_SETS = [
  UPPERCASE_CHARACTERS,
  LOWERCASE_CHARACTERS,
  DIGIT_CHARACTERS,
  SPECIAL_CHARACTERS,
] as const;
const ALL_CHARACTERS = REQUIRED_CHARACTER_SETS.join('');

function secureRandomIndex(maxExclusive: number): number {
  const range = 2 ** 32;
  const rejectionLimit = range - (range % maxExclusive);
  const randomValue = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(randomValue);
  } while (randomValue[0] >= rejectionLimit);
  return randomValue[0] % maxExclusive;
}

function pickCharacter(characters: string): string {
  return characters[secureRandomIndex(characters.length)];
}

export function generateInitialPassword(): string {
  const characters = REQUIRED_CHARACTER_SETS.map(pickCharacter);
  while (characters.length < INITIAL_PASSWORD_LENGTH) {
    characters.push(pickCharacter(ALL_CHARACTERS));
  }
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join('');
}
