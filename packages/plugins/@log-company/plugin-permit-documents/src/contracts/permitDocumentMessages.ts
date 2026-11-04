/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export const registryErrorMessages: Readonly<Record<string, string>> = {
  REGISTRY_NOT_CONFIGURED: 'Подключение к реестру не настроено. Обратитесь к администратору.',
  REGISTRY_AUTHENTICATION_FAILED:
    'Не удалось войти в реестр. Повторите проверку позже; если ошибка повторится, обратитесь к администратору.',
  REGISTRY_TEMPORARY_UNAVAILABLE:
    'Реестр временно недоступен. Повторите проверку позже; автоматическая проверка также будет повторена.',
  INVALID_REGISTRY_RESPONSE:
    'Реестр вернул неполные или некорректные сведения. Проверьте номер и тип документа, затем повторите проверку.',
  TECHNICAL_REGULATION_CONFLICT:
    'Сведения о техническом регламенте расходятся со справочником. Обратитесь к администратору.',
  REGISTRY_RECORD_MISSING:
    'Ранее найденная запись больше не доступна в реестре. Проверьте документ в реестре и повторите проверку.',
  INTERNAL_SYNC_ERROR:
    'Не удалось обработать результат проверки. Повторите проверку; если ошибка повторится, обратитесь к администратору.',
};

export function registryErrorMessage(code: unknown): string {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(registryErrorMessages, code)
    ? registryErrorMessages[code]
    : registryErrorMessages.INTERNAL_SYNC_ERROR;
}

export const documentNotFoundMessage =
  'Документ не найден в реестре. Проверьте номер и тип документа, исправьте их и сохраните либо нажмите «Проверить сейчас».';
