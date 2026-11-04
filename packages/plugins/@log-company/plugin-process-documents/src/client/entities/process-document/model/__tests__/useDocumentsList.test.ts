/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DocumentRequestScope } from '../../../../../contracts/processDocuments';
import { ProcessDocumentsApi } from '../../api/ProcessDocumentsApi';
import { useDocumentsList } from '../useDocumentsList';

const response = (id: string) => ({
  breadcrumbs: [],
  folders: [],
  files: [{ id, title: id }],
  permissions: { canWrite: true, canDelete: true },
});
const shipment: DocumentRequestScope = { shipmentId: 'first' };

function deferred() {
  let complete: (value: unknown) => void = () => {
    throw new Error('Deferred response has not initialized');
  };
  const promise = new Promise<unknown>((resolve) => {
    complete = resolve;
  });
  return { promise, resolve: complete };
}

describe('document listing lifecycle', () => {
  it('does not request data without a saved record or draft', () => {
    const request = vi.fn();
    const api = new ProcessDocumentsApi({ request });
    const { result } = renderHook(() => useDocumentsList(api, null));
    expect(request).not.toHaveBeenCalled();
    expect(result.current.files).toEqual([]);
    expect(result.current.canWrite).toBe(false);
  });

  it('displays loading, a valid response and refreshed data', async () => {
    const pending = deferred();
    const request = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(response('second'));
    const api = new ProcessDocumentsApi({ request });
    const { result } = renderHook(() => useDocumentsList(api, shipment));
    expect(result.current.loading).toBe(true);
    await act(async () => pending.resolve(response('first')));
    expect(result.current.files[0].id).toBe('first');
    expect(result.current.loading).toBe(false);
    await act(async () => result.current.load());
    expect(result.current.files[0].id).toBe('second');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('ignores an old shipment response after the active shipment changes', async () => {
    const pending = deferred();
    const request = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(response('new'));
    const api = new ProcessDocumentsApi({ request });
    const { result, rerender } = renderHook(({ scope }) => useDocumentsList(api, scope), {
      initialProps: { scope: shipment },
    });
    rerender({ scope: { shipmentId: 'new' } });
    await waitFor(() => expect(result.current.files[0]?.id).toBe('new'));
    await act(async () => pending.resolve(response('old')));
    expect(result.current.files[0].id).toBe('new');
  });

  it('ignores a refresh captured before the shipment changed', async () => {
    const pending = deferred();
    const request = vi.fn().mockResolvedValueOnce(response('first')).mockReturnValueOnce(pending.promise);
    const api = new ProcessDocumentsApi({ request });
    const { result, rerender } = renderHook(({ scope }) => useDocumentsList(api, scope), {
      initialProps: { scope: shipment },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const refreshPreviousShipment = result.current.load;
    rerender({ scope: { shipmentId: 'new' } });
    await act(async () => refreshPreviousShipment());
    expect(request).toHaveBeenCalledTimes(2);
    await act(async () => pending.resolve(response('new')));
    expect(result.current.files[0].id).toBe('new');
    expect(result.current.loading).toBe(false);
  });

  it('resets the selected folder when switching from a draft to a shipment', async () => {
    const request = vi.fn().mockResolvedValue(response('file'));
    const api = new ProcessDocumentsApi({ request });
    const draft: DocumentRequestScope = { draftToken: 'draft' };
    const { result, rerender } = renderHook(
      ({ scope }: { scope: DocumentRequestScope }) => useDocumentsList(api, scope),
      { initialProps: { scope: draft } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setFolderId('folder'));
    await waitFor(() =>
      expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: { draftToken: 'draft', folderId: 'folder' } }),
      ),
    );
    rerender({ scope: shipment });
    await waitFor(() =>
      expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: { shipmentId: 'first', folderId: null } }),
      ),
    );
    expect(result.current.folderId).toBeNull();
  });

  it('disables mutation permissions on failure and recovers on retry', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce({ response: { data: { errors: [{ message: 'Нет доступа' }] } } })
      .mockResolvedValue(response('file'));
    const api = new ProcessDocumentsApi({ request });
    const { result } = renderHook(() => useDocumentsList(api, shipment));
    await waitFor(() => expect(result.current.error).toBe('Нет доступа'));
    expect(result.current.canDelete).toBe(false);
    await act(async () => result.current.load());
    expect(result.current.error).toBeNull();
    expect(result.current.canDelete).toBe(true);
  });
});
