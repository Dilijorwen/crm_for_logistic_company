/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useTranslation } = vi.hoisted(() => ({
  useTranslation: vi.fn(() => ({ t: (key: string) => key })),
}));

vi.mock('react-i18next', () => ({ useTranslation }));

import { NAMESPACE, tExpr, useProcessDiscussionTranslation } from '../locale';

describe('process discussion locale', () => {
  beforeEach(() => {
    useTranslation.mockClear();
  });

  it('uses the NocoBase namespace fallback chain', () => {
    useProcessDiscussionTranslation();

    expect(useTranslation).toHaveBeenCalledWith([NAMESPACE, 'client'], { nsMode: 'fallback' });
  });

  it('creates a FlowEngine translation expression with the same fallback chain', () => {
    expect(tExpr('discussion.blockTitle')).toBe(
      `{{t("discussion.blockTitle", { ns: ['${NAMESPACE}', 'client'], nsMode: 'fallback' })}}`,
    );
  });
});
