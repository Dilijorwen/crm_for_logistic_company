/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePermitDocumentSyncActionProps } from '../usePermitDocumentSyncActionProps';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  refreshAsync: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@nocobase/client', () => ({
  useAPIClient: () => ({ request: mocks.request }),
  useDataBlockRequestGetter: () => ({ getDataBlockRequest: () => ({ refreshAsync: mocks.refreshAsync }) }),
  useRecord: () => ({ id: '42' }),
}));

vi.mock('antd', () => ({ App: { useApp: () => ({ message: { success: mocks.success, error: mocks.error } }) } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('usePermitDocumentSyncActionProps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refreshAsync.mockResolvedValue(undefined);
  });

  it('waits for the completed check, refreshes the full table and blocks a repeated click in flight', async () => {
    let resolveRequest: (() => void) | null = null;
    mocks.request.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const { result } = renderHook(() => usePermitDocumentSyncActionProps());

    let first: Promise<void>;
    await act(async () => {
      first = result.current.onClick();
      await result.current.onClick();
    });
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.request).toHaveBeenCalledWith({ url: '/permit_documents:sync/42', method: 'post' });
    expect(mocks.refreshAsync).not.toHaveBeenCalled();
    await act(async () => {
      resolveRequest?.();
      await first;
    });
    expect(mocks.success).toHaveBeenCalledWith('action.checkCompleted');
    expect(mocks.refreshAsync).toHaveBeenCalledOnce();
  });

  it('shows a safe error and restores the action after failure', async () => {
    mocks.request.mockRejectedValue(new Error('internal details'));
    const { result } = renderHook(() => usePermitDocumentSyncActionProps());
    await act(async () => {
      await result.current.onClick();
    });
    expect(mocks.error).toHaveBeenCalledWith('errors.checkFailed');
    expect(mocks.refreshAsync).toHaveBeenCalledOnce();
    expect(result.current.loading).toBe(false);
  });

  it('restores the action and reports when the table refresh fails', async () => {
    mocks.request.mockResolvedValue(undefined);
    mocks.refreshAsync.mockRejectedValue(new Error('refresh failed'));
    const { result } = renderHook(() => usePermitDocumentSyncActionProps());
    await act(async () => {
      await result.current.onClick();
    });
    expect(mocks.error).toHaveBeenCalledWith('errors.refreshFailed');
    expect(result.current.loading).toBe(false);
  });
});
