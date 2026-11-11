/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { categoryFieldState } from '../categoryFields';

describe('permit document category form fields', () => {
  it('hides company for rentals and requires two rental dates', () => {
    expect(categoryFieldState('rented', 'company', true)?.visible).toBe(false);
    for (const name of ['rental_from', 'rental_until'])
      expect(categoryFieldState('rented', name, true)).toMatchObject({
        visible: true,
        required: true,
        disabled: false,
      });
    expect(categoryFieldState('ordinary', 'rental_from', true)?.visible).toBe(false);
  });
  it('requires editable manual fields for voluntary documents and forbids pairs', () => {
    for (const name of [
      'valid_from',
      'valid_until',
      'manufacturer_name',
      'manufacturer_address',
      'technical_regulations',
      'documents',
      'company',
    ]) {
      expect(categoryFieldState('voluntary', name, true)).toMatchObject({
        visible: true,
        required: true,
        disabled: false,
      });
    }
    expect(categoryFieldState('voluntary', 'related_document', true)?.visible).toBe(false);
    expect(categoryFieldState('voluntary', 'document_type', true)?.disabled).toBe(true);
  });
  it('hides registry information and immutable fields on edit as well as ordinary creation', () => {
    expect(categoryFieldState('ordinary', 'manufacturer_name', false)).toMatchObject({
      visible: false,
      disabled: true,
    });
    expect(categoryFieldState('ordinary', 'manufacturer_name', true)?.visible).toBe(false);
    expect(categoryFieldState('ordinary', 'related_document', false)?.visible).toBe(false);
    for (const category of ['ordinary', 'rented', 'voluntary'] as const) {
      for (const name of ['status', 'sync_status', 'period_from', 'period_until', 'internal_number', 'last_checked_at'])
        expect(categoryFieldState(category, name, false)).toMatchObject({ visible: false, disabled: true });
    }
  });
  it.each(['ordinary', 'rented'] as const)('allows optional regulation selection only on %s edit', (category) => {
    expect(categoryFieldState(category, 'technical_regulations', false)).toEqual({
      visible: true,
      disabled: false,
      required: false,
    });
    expect(categoryFieldState(category, 'technical_regulations', true)).toEqual({
      visible: false,
      disabled: true,
      required: false,
    });
  });
});
