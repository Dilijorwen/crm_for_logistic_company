/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { ProcessDocumentsApi } from '../ProcessDocumentsApi';

const listing = {
  breadcrumbs: [],
  folders: [{ id: 'folder', title: 'Документы' }],
  files: [],
  permissions: { canWrite: true, canDelete: false },
};

describe('ProcessDocumentsApi contract', () => {
  it.each([listing, { data: listing }, { data: { data: listing } }])(
    'decodes the server envelope',
    async (response) => {
      const request = vi.fn().mockResolvedValue(response);
      const api = new ProcessDocumentsApi({ request });
      expect(await api.list({ shipmentId: '42' }, null)).toEqual(listing);
      expect(request).toHaveBeenCalledWith({
        url: 'processDocuments:list',
        method: 'post',
        data: { shipmentId: '42', folderId: null },
      });
    },
  );

  it.each([{}, { ...listing, files: [{}] }, { ...listing, permissions: { canWrite: 'yes' } }])(
    'rejects invalid responses',
    async (response) => {
      const api = new ProcessDocumentsApi({ request: vi.fn().mockResolvedValue(response) });
      await expect(api.list({ shipmentId: '42' }, null)).rejects.toThrow('некорректный список');
    },
  );

  it.each([403, 404, 503])('preserves HTTP failure %s for the UI', async (status) => {
    const error = { response: { status } };
    const api = new ProcessDocumentsApi({ request: vi.fn().mockRejectedValue(error) });
    await expect(api.list({ shipmentId: '42' }, null)).rejects.toBe(error);
  });

  it('uploads the folder hierarchy to the draft scope', async () => {
    const request = vi.fn().mockResolvedValue({});
    const api = new ProcessDocumentsApi({ request });
    const file = new File(['content'], 'договор.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'webkitRelativePath', { value: 'Поставка/договор.txt' });
    await api.upload({ draftToken: 'draft-token' }, 'folder', [file]);
    const data = request.mock.calls[0][0].data as FormData;
    expect(data.get('draftToken')).toBe('draft-token');
    expect(data.get('shipmentId')).toBeNull();
    expect(data.get('folderId')).toBe('folder');
    expect((data.get('files') as File).name).toBe('Поставка/договор.txt');
    expect(request.mock.calls[0][0].url).toBe('processDocuments:uploadFiles');
  });

  it('sends no upload for an empty selection and preserves a zero identifier', async () => {
    const request = vi.fn().mockResolvedValue({});
    const api = new ProcessDocumentsApi({ request });
    await api.upload({ shipmentId: 0 }, 0, []);
    expect(request).not.toHaveBeenCalled();
    await api.upload({ shipmentId: 0 }, 0, [new File(['data'], 'file.txt')]);
    const data = request.mock.calls[0][0].data as FormData;
    expect(data.get('shipmentId')).toBe('0');
    expect(data.get('folderId')).toBe('0');
  });

  it('uses the same scope for delete summary and destructive actions', async () => {
    const request = vi.fn().mockResolvedValue({ data: { folders: 2, files: 3 } });
    const api = new ProcessDocumentsApi({ request });
    expect(await api.folderDeleteSummary('folder', 'draft')).toEqual({ folders: 2, files: 3 });
    await api.deleteFolder('folder', 'draft');
    await api.deleteFile('file', 'draft');
    expect(request.mock.calls.map(([config]) => config)).toEqual([
      {
        url: 'processDocuments:folderDeleteSummary',
        method: 'post',
        data: { folderId: 'folder', draftToken: 'draft' },
      },
      { url: 'processDocuments:deleteFolder', method: 'post', data: { folderId: 'folder', draftToken: 'draft' } },
      { url: 'processDocuments:deleteFile', method: 'post', data: { documentId: 'file', draftToken: 'draft' } },
    ]);
  });

  it.each([-1, 1.5, '2', null])('rejects invalid delete counts: %s', async (files) => {
    const api = new ProcessDocumentsApi({ request: vi.fn().mockResolvedValue({ files, folders: 0 }) });
    await expect(api.folderDeleteSummary('folder')).rejects.toThrow('некорректное содержимое');
  });
});
