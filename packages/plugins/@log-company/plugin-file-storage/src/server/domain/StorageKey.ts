/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export function storageAreaPrefix(application: string, area: string): string {
  for (const segment of [application, area]) {
    if (!/^[a-zA-Z0-9_-]+$/.test(segment)) {
      throw new Error('Некорректная область файлового хранилища.');
    }
  }
  return `v1/${application}/${area}/`;
}

export function validateStorageKey(key: string): string {
  if (
    !key ||
    key.length > 1024 ||
    Array.from(key).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 || character === '\\';
    }) ||
    key.startsWith('/')
  ) {
    throw new Error('Некорректный ключ файла.');
  }
  if (key.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new Error('Некорректный ключ файла.');
  }
  return key;
}
