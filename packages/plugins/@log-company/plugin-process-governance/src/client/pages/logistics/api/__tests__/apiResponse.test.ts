/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { apiErrorMessage, isFormValidationError } from '../apiResponse';

describe('logistics API response helpers', () => {
  it('recognizes the rejection shape returned by Ant Design form validation', () => {
    expect(isFormValidationError({ errorFields: [{ name: ['registrationNumber'], errors: ['Required'] }] })).toBe(true);
    expect(isFormValidationError(new Error('network'))).toBe(false);
  });

  it('uses the first public API error without exposing internal error objects', () => {
    expect(
      apiErrorMessage(
        { response: { data: { errors: [{ message: 'Сначала уберите поставку из всех рейсов.' }] } } },
        'Ошибка',
      ),
    ).toBe('Сначала уберите поставку из всех рейсов.');
    expect(apiErrorMessage(new Error('secret details'), 'Ошибка')).toBe('Ошибка');
  });
});
