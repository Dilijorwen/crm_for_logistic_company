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
import { PermitStatusTags, PermitDocumentStatusFieldModel } from '../PermitDocumentStatus';

describe('permit document status display', () => {
  it('shows the registry status and rental expiry without replacing one with the other', () => {
    render(<PermitStatusTags value="valid" rentalStatus="expired" />);
    expect(screen.getByText('Действителен')).toBeTruthy();
    expect(screen.getByText('Аренда истекла')).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(PermitDocumentStatusFieldModel.prototype, 'render')).toBe(false);
  });
  it('still shows rental expiry when the registry status is missing', () => {
    render(<PermitStatusTags value={null} rentalStatus="expired" />);
    expect(screen.getByText('Аренда истекла')).toBeTruthy();
  });
});
