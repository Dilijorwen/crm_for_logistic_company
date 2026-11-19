/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export class FileStorageError extends Error {
  constructor(readonly code: 'not-found' | 'unavailable' | 'conflict') {
    super(
      {
        'not-found': 'Файл не найден.',
        unavailable: 'Файловое хранилище временно недоступно. Повторите попытку позже.',
        conflict: 'Файл уже существует. Повторите загрузку.',
      }[code],
    );
  }
}
