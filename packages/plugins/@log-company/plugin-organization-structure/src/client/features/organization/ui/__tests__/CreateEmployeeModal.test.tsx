/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { act, fireEvent, render, screen } from '@nocobase/test/client';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../locale', () => ({
  useOrganizationTranslation: () => ({ t: (key: string) => key }),
}));

import { CreateEmployeeModal } from '../CreateEmployeeModal';

async function flushFormValidation(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('CreateEmployeeModal', () => {
  it('validates required fields before submission', async () => {
    const onSubmit = vi.fn();
    render(<CreateEmployeeModal open loading={false} onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'common.create' }));
    await flushFormValidation();

    expect(screen.getByLabelText('employees.fullName')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('employees.email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('employees.login')).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed full name, email, and login', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreateEmployeeModal open loading={false} onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('employees.fullName'), { target: { value: '  Anna Employee  ' } });
    fireEvent.change(screen.getByLabelText('employees.email'), { target: { value: '  anna@example.test  ' } });
    fireEvent.change(screen.getByLabelText('employees.login'), { target: { value: '  anna.employee  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.create' }));
    await flushFormValidation();

    expect(onSubmit).toHaveBeenCalledWith({
      nickname: 'Anna Employee',
      email: 'anna@example.test',
      username: 'anna.employee',
    });
  });

  it('blocks repeated confirmation while the request is pending', async () => {
    let finishSubmission: (() => void) | undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSubmission = resolve;
        }),
    );
    render(<CreateEmployeeModal open loading={false} onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('employees.fullName'), { target: { value: 'Anna Employee' } });
    fireEvent.change(screen.getByLabelText('employees.email'), { target: { value: 'anna@example.test' } });
    fireEvent.change(screen.getByLabelText('employees.login'), { target: { value: 'anna.employee' } });
    const submitButton = screen.getByRole('button', { name: 'common.create' });
    fireEvent.click(submitButton);
    await flushFormValidation();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    fireEvent.click(submitButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    await act(async () => finishSubmission?.());
    await flushFormValidation();
    expect(submitButton).not.toBeDisabled();
  });
});
