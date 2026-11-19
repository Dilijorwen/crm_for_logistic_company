/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';
import { describe, expect, it, vi } from 'vitest';
import { RecordAttachmentsApi } from '../RecordAttachmentsApi';

function fixture(multiple = true) {
  const get = vi
    .fn()
    .mockResolvedValue({ data: { data: { documents: [] }, meta: { allowedActions: { update: [42] } } } });
  const request = vi.fn(async ({ url }) => ({
    data: {
      data:
        url === 'processDocuments:attachmentPermissions'
          ? { canRead: true, canWrite: true, canDelete: true }
          : { id: '51' },
    },
  }));
  const add = vi.fn();
  const update = vi.fn();
  const resource = vi.fn(() => ({ get, add, update }));
  const api = new RecordAttachmentsApi(
    { resource, request } as unknown as APIClient,
    'permit_documents',
    '42',
    'documents',
    multiple,
    'main',
  );
  return { api, get, request, resource, add, update };
}

describe('record attachment field', () => {
  it('returns an empty, writable list for an accessible saved record with no attachments', async () => {
    const { api, get } = fixture();
    await expect(api.load()).resolves.toEqual({ files: [], canUpdate: true, canDelete: true });
    expect(get).toHaveBeenCalledWith({ filterByTk: '42', appends: ['documents'] });
  });

  it('distinguishes denied access from an empty field or read-only record', async () => {
    const { api, get } = fixture();
    get.mockResolvedValueOnce({ data: { data: { id: 42 } } });
    await expect(api.load()).rejects.toThrow('Нет доступа');
    get.mockResolvedValueOnce({ data: { data: { documents: [] }, meta: { allowedActions: { update: [43] } } } });
    await expect(api.load()).resolves.toEqual({ files: [], canUpdate: false, canDelete: false });
  });

  it('does not fetch files when the section denies viewing', async () => {
    const { api, get, request } = fixture();
    request.mockResolvedValueOnce({ data: { data: { canRead: false, canWrite: false, canDelete: false } } });
    await expect(api.load()).resolves.toMatchObject({ hidden: true, files: [] });
    expect(get).not.toHaveBeenCalled();
  });

  it('uses the native field storage and requests deletion scoped to its card', async () => {
    const { api, request, resource, add } = fixture();
    const file = new File(['test'], 'document.txt');
    const id = await api.upload(file);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'attachments:create',
        params: { attachmentField: 'permit_documents.documents' },
      }),
    );
    expect(request.mock.calls[0][0].data.get('file')).toBe(file);
    await api.link(id);
    expect(resource).toHaveBeenLastCalledWith('permit_documents.documents', '42', expect.anything());
    expect(add).toHaveBeenCalledWith({ values: ['51'] });
    await api.deleteFile(id);
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: 'processDocuments:deleteAttachment',
        data: { collection: 'permit_documents', recordId: '42', field: 'documents', attachmentId: '51' },
      }),
    );
  });

  it('updates a single attachment through the record update action', async () => {
    const { api, update, add } = fixture(false);
    await api.link('51');
    expect(add).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ filterByTk: '42', values: { documents: '51' } });
  });
});
