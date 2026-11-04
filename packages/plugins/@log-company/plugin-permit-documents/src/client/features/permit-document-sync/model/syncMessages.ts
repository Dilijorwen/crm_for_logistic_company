/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { documentNotFoundMessage, registryErrorMessage } from '../../../../contracts/permitDocumentMessages';

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function syncResultMessage(response: unknown): {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
} {
  const body = object(object(response).data);
  const result = 'syncStatus' in body ? body : object(body.data);
  switch (result.syncStatus) {
    case 'SUCCESS':
      return { type: 'success', message: 'Документ проверен. Сведения обновлены.' };
    case 'NOT_FOUND':
      return { type: 'warning', message: documentNotFoundMessage };
    case 'ERROR':
      return { type: 'error', message: registryErrorMessage(result.errorCode) };
    case 'NOT_REQUIRED':
      return { type: 'info', message: 'Для добровольного документа проверка по реестру не требуется.' };
    default:
      return {
        type: 'error',
        message: 'Сервис проверки вернул неизвестный результат. Обновите страницу и повторите проверку.',
      };
  }
}

export function syncRequestErrorMessage(error: unknown): string {
  const details = object(error);
  const response = object(details.response);
  const body = object(response.data);
  const errors = Array.isArray(body.errors) ? body.errors : [];
  const first = object(errors[0]);
  if (
    first.code === 'REGISTRY_TEMPORARY_UNAVAILABLE' ||
    first.code === 'REGISTRY_AUTHENTICATION_FAILED' ||
    first.code === 'REGISTRY_NOT_CONFIGURED'
  )
    return registryErrorMessage(first.code);
  switch (response.status) {
    case 401:
      return 'Сессия закончилась. Войдите в CRM и повторите проверку.';
    case 403:
      return 'Недостаточно прав для проверки этого документа.';
    case 404:
      return 'Документ не найден или недоступен. Обновите таблицу.';
    case 409:
      return 'Во время проверки документ изменился. Повторите проверку.';
    case 400:
    case 422:
      return 'Не удалось проверить документ. Проверьте сохранённый номер и тип документа.';
    case 502:
    case 503:
    case 504:
      return 'Сервис проверки временно недоступен. Повторите проверку позже.';
  }
  if (details.code === 'ERR_NETWORK' || details.code === 'ECONNABORTED' || details.code === 'ETIMEDOUT')
    return 'Нет ответа от CRM. Проверьте подключение и повторите проверку.';
  return 'Не удалось проверить документ. Повторите проверку позже.';
}
