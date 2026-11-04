/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ForeignKeyConstraintError, UniqueConstraintError, ValidationError, ValidationErrorItem } from 'sequelize';
import { describe, expect, it } from 'vitest';
import { permitDocumentSaveError } from '../PermitDocumentSaveError';

describe('permit document save error presentation', () => {
  it('names the missing field without exposing internal field identifiers', () => {
    const result = permitDocumentSaveError(
      new ValidationError('internal', [new ValidationErrorItem('secret', 'notNull Violation', 'title', null)]),
    );
    expect(result).toMatchObject({ status: 422, message: 'Заполните поле «Номер документа».' });
    expect(result.message).not.toMatch(/secret|title/);
  });
  it('explains uniqueness and invalid associations', () => {
    expect(permitDocumentSaveError(new UniqueConstraintError({ message: 'SQL secret', errors: [] }))).toMatchObject({
      status: 409,
      code: 'PERMIT_DOCUMENT_DUPLICATE',
    });
    expect(permitDocumentSaveError(new ForeignKeyConstraintError({ message: 'SQL secret' }))).toMatchObject({
      status: 422,
      code: 'PERMIT_DOCUMENT_INVALID_RELATION',
    });
  });
  it('preserves known validation and access messages but removes internal causes', () => {
    for (const status of [403, 404, 422]) {
      const result = permitDocumentSaveError(
        Object.assign(new Error('Выберите существующий документ.'), {
          status,
          code: 'INVALID_RELATED_DOCUMENT',
          cause: new Error('SQL secret'),
        }),
      );
      expect(result).toMatchObject({
        status,
        code: 'INVALID_RELATED_DOCUMENT',
        message: 'Выберите существующий документ.',
      });
      expect(result.cause).toBeUndefined();
    }
  });
  it('does not leak unexpected exceptions or unknown field paths', () => {
    expect(permitDocumentSaveError(new Error('SELECT private password'))).toMatchObject({
      status: 500,
      code: 'PERMIT_DOCUMENT_SAVE_FAILED',
    });
    expect(
      permitDocumentSaveError(
        new ValidationError('secret', [new ValidationErrorItem('secret', 'Validation error', 'private_password', '')]),
      ).message,
    ).not.toContain('password');
    expect(permitDocumentSaveError(Object.assign(new Error('SQL secret'), { status: 400 })).message).not.toContain(
      'SQL',
    );
  });
});
