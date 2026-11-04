/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PermitDocumentSyncError, PermitDocumentSyncErrorFieldModel } from '../PermitDocumentSyncError';

describe('stored synchronization error display', () => {
  it('displays the human explanation instead of the saved code', () => {
    render(<PermitDocumentSyncError value="REGISTRY_NOT_CONFIGURED" />);
    expect(screen.getByText('Подключение к реестру не настроено. Обратитесь к администратору.')).toBeTruthy();
    expect(screen.queryByText('REGISTRY_NOT_CONFIGURED')).toBeNull();
  });
  it('also translates stored codes in native FlowEngine display fields', () => {
    const model = Object.create(PermitDocumentSyncErrorFieldModel.prototype) as PermitDocumentSyncErrorFieldModel;
    expect(model.t('REGISTRY_AUTHENTICATION_FAILED')).toContain('Не удалось войти в реестр');
    expect(model.t(null)).toBeNull();
    expect(model.t('unknown secret')).not.toContain('secret');
  });
});
