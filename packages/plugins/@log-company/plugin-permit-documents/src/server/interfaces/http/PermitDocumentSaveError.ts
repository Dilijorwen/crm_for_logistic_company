/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ForeignKeyConstraintError, UniqueConstraintError, ValidationError } from 'sequelize';

const fieldLabels: Readonly<Record<string, string>> = {
  title: 'Номер документа',
  document_type: 'Тип документа',
  category: 'Категория',
  company_id: 'Компания',
  valid_from: 'Действует с',
  valid_until: 'Действует до',
  rental_from: 'Аренда с',
  rental_until: 'Аренда до',
  product_information: 'Сведения о продукции',
  manufacturer_name: 'Изготовитель',
  manufacturer_address: 'Адрес изготовителя',
};

const publicCodes = new Set([
  'INVALID_DOCUMENT_TYPE',
  'INVALID_STATUS',
  'INVALID_SYNC_STATUS',
  'INVALID_DATE',
  'INVALID_DATE_RANGE',
  'MISSING_SUCCESS_FIELD',
  'UNEXPECTED_VALID_UNTIL',
  'INVALID_DOCUMENT_CATEGORY',
  'RENTED_DOCUMENT_COMPANY',
  'INVALID_RENTAL_PERIOD',
  'UNEXPECTED_RENTAL_PERIOD',
  'VOLUNTARY_DOCUMENT_TYPE',
  'VOLUNTARY_DOCUMENT_PAIR',
  'INCOMPLETE_VOLUNTARY_DOCUMENT',
  'INVALID_VOLUNTARY_PERIOD',
  'INVALID_RELATED_DOCUMENT',
  'SELF_RELATED_DOCUMENT',
  'RELATED_DOCUMENT_NOT_FOUND',
  'RELATED_DOCUMENT_ACCESS_DENIED',
  'RELATED_DOCUMENT_ALREADY_PAIRED',
  'INVALID_INTERNAL_NUMBER',
  'INTERNAL_NUMBER_READ_ONLY',
  'RELATED_DOCUMENT_READ_ONLY',
  'PERMIT_NUMBERING_READ_ONLY',
  'INVALID_SELECTED_RECORD',
]);
const publicMessages = new Set([
  'Выберите технические регламенты.',
  'Технические регламенты этого документа заполняются из реестра.',
  'Реестровые поля и связи изменяются только синхронизацией.',
  'Связанный документ можно выбрать только при создании.',
]);

function publicError(status: number, message: string, code: string): Error {
  return Object.assign(new Error(message), { status, statusCode: status, code });
}

export function permitDocumentSaveError(error: unknown): Error {
  if (error instanceof UniqueConstraintError) {
    return publicError(
      409,
      'Не удалось сохранить документ: запись с такими уникальными значениями уже существует. Проверьте номер и тип документа.',
      'PERMIT_DOCUMENT_DUPLICATE',
    );
  }
  if (error instanceof ForeignKeyConstraintError) {
    return publicError(
      422,
      'Одна из выбранных записей больше не существует. Заново выберите компанию, технические регламенты, файлы или связанный документ.',
      'PERMIT_DOCUMENT_INVALID_RELATION',
    );
  }
  if (error instanceof ValidationError) {
    const messages = error.errors.map((item) => {
      const label = item.path && fieldLabels[item.path];
      if (!label) return 'Проверьте обязательные поля и допустимые значения документа.';
      return item.type?.toLowerCase() === 'notnull violation' || item.validatorKey === 'is_null'
        ? `Заполните поле «${label}».`
        : `Проверьте значение поля «${label}».`;
    });
    return publicError(
      422,
      [...new Set(messages)].join(' ') || 'Проверьте заполненные поля документа.',
      'PERMIT_DOCUMENT_VALIDATION',
    );
  }
  if (error instanceof Error) {
    const details = error as Error & { status?: number; statusCode?: number; code?: string };
    const status = details.statusCode ?? details.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      // Recreate the public error so the standard NocoBase handler cannot append a nested cause/SQL message.
      const isKnown = (details.code && publicCodes.has(details.code)) || publicMessages.has(details.message);
      const fallback =
        status === 403
          ? 'Недостаточно прав для изменения этого документа.'
          : status === 404
            ? 'Выбранная запись не найдена или недоступна.'
            : 'Не удалось сохранить документ. Проверьте заполненные поля.';
      return publicError(
        status,
        isKnown ? details.message : fallback,
        isKnown && details.code ? details.code : 'PERMIT_DOCUMENT_INVALID_REQUEST',
      );
    }
  }
  return publicError(
    500,
    'Не удалось сохранить документ. Повторите отправку; если ошибка повторится, обратитесь к администратору.',
    'PERMIT_DOCUMENT_SAVE_FAILED',
  );
}
