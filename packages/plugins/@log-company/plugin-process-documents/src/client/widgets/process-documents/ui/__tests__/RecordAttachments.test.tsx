/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { Blob as NodeBlob } from 'node:buffer';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { utils, write } from 'xlsx';
import { RecordAttachments } from '../RecordAttachments';
import { readDocumentPreview } from '../../model/documentPreview';

const { get, add, request, client } = vi.hoisted(() => {
  const get = vi.fn();
  const add = vi.fn();
  const request = vi.fn();
  return { get, add, request, client: { resource: vi.fn(() => ({ get, add })), request } };
});
vi.mock('@nocobase/client', () => ({ useAPIClient: () => client }));

const fields = [{ name: 'documents', title: 'Документы', multiple: true, readOnly: false }];
const canUpdateField = async () => true;
const emptyField = { data: { data: { documents: [] }, meta: { allowedActions: { update: ['7'] } } } };

describe('Документы в карточке разрешения', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    request.mockImplementation(async ({ url }) => ({
      data: {
        data:
          url === 'processDocuments:attachmentPermissions'
            ? { canRead: true, canWrite: true, canDelete: true }
            : { id: '12' },
      },
    }));
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    });
  });

  it('offers an upload on an empty accessible record, then shows the attached file', async () => {
    get.mockResolvedValueOnce(emptyField).mockResolvedValue({
      data: {
        data: { documents: [{ id: '12', title: 'certificate.pdf' }] },
        meta: { allowedActions: { update: ['7'] } },
      },
    });
    const { container } = render(
      <RecordAttachments
        collection="permit_documents"
        recordId="7"
        dataSourceKey="main"
        fields={fields}
        canUpdateField={canUpdateField}
      />,
    );
    expect(await screen.findByText('Документов пока нет')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Загрузить файл' })).toBeTruthy();
    const input = container.querySelector('input[type=file]');
    if (!input) throw new Error('File input not found');
    fireEvent.change(input, { target: { files: [new File(['test'], 'certificate.pdf')] } });
    await waitFor(() => expect(add).toHaveBeenCalledWith({ values: ['12'] }));
    expect(await screen.findByRole('button', { name: 'certificate.pdf' })).toBeTruthy();
  });

  it('displays the empty field without an upload action for a read-only record', async () => {
    get.mockResolvedValue({ data: { data: { documents: [] }, meta: { allowedActions: { update: [] } } } });
    render(
      <RecordAttachments
        collection="permit_documents"
        recordId="7"
        dataSourceKey="main"
        fields={fields}
        canUpdateField={canUpdateField}
      />,
    );
    expect(await screen.findByText('Документов пока нет')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Загрузить файл' })).toBeNull();
  });

  it('requires confirmation before deleting the stored file', async () => {
    get.mockResolvedValue({
      data: {
        data: { documents: [{ id: '12', title: 'test', extname: '.xlsx' }] },
        meta: { allowedActions: { update: ['7'] } },
      },
    });
    render(
      <RecordAttachments
        collection="permit_documents"
        recordId="7"
        dataSourceKey="main"
        fields={fields}
        canUpdateField={canUpdateField}
      />,
    );
    const remove = await screen.findByRole('button', { name: 'Удалить' });
    expect(screen.queryByRole('button', { name: 'Убрать' })).toBeNull();
    fireEvent.click(remove);
    const confirmation = await screen.findByRole('dialog', { name: 'Удалить файл «test.xlsx»?' });
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ url: 'processDocuments:deleteAttachment' }));
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Удалить' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'processDocuments:deleteAttachment',
          data: { collection: 'permit_documents', recordId: '7', field: 'documents', attachmentId: '12' },
        }),
      ),
    );
  });

  it('opens unsupported files in the same dialog with a download action', async () => {
    get.mockResolvedValue({
      data: { data: { documents: [{ id: '12', title: 'архив.7z' }] }, meta: { allowedActions: { update: [] } } },
    });
    render(<RecordAttachments collection="permit_documents" recordId="7" dataSourceKey="main" fields={fields} />);
    fireEvent.click(await screen.findByRole('button', { name: 'архив.7z' }));
    expect(await screen.findByText('Для этого формата нет предпросмотра. Файл можно скачать.')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'архив.7z' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Скачать' })).toBeTruthy();
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ url: 'attachments:create' }));
  });

  it.each(['xlsx', 'xls'] as const)('shows actual cell values from a private .%s attachment', async (bookType) => {
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, utils.aoa_to_sheet([['Номер инвойса', 'A-10']]), 'Реестр');
    const blob = new NodeBlob([write(workbook, { bookType, type: 'array' })]);
    await expect(readDocumentPreview(`Реестр.${bookType}`, blob as unknown as Blob)).resolves.toMatchObject({
      kind: 'table',
      sheets: [{ name: 'Реестр', rows: [['Номер инвойса', 'A-10']] }],
    });
    const fetchFile = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: async () => blob,
    } as unknown as Response);
    try {
      get.mockResolvedValue({
        data: {
          data: {
            documents: [{ id: '12', title: 'Реестр', extname: `.${bookType}`, url: '/api/fileStorage:open?id=12' }],
          },
        },
      });
      render(<RecordAttachments collection="permit_documents" recordId="7" dataSourceKey="main" fields={fields} />);
      fireEvent.click(await screen.findByRole('button', { name: `Реестр.${bookType}` }, { timeout: 2500 }));
      expect(await screen.findByRole('cell', { name: 'Номер инвойса' }, { timeout: 5000 })).toBeTruthy();
      expect(screen.getByRole('table', { name: 'Реестр' })).toBeTruthy();
      expect(fetchFile.mock.calls[0][0]).toEqual(new URL('/api/fileStorage:open?id=12', window.location.origin));
      expect(get).toHaveBeenCalledTimes(2);
    } finally {
      fetchFile.mockRestore();
    }
  });
});
