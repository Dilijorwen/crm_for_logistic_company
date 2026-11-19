/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScopedDocuments } from '../ScopedDocuments';

const { request, list } = vi.hoisted(() => ({ request: vi.fn(), list: vi.fn() }));
const client = { request, resource: () => ({ list }) };

vi.mock('@nocobase/client', () => ({ useAPIClient: () => client, css: () => '' }));

const scope = { companyId: '10', runId: '87' };
const folder = { id: '55', title: 'Декларантам', grants: null };

describe('Доступ к открытой папке', () => {
  beforeEach(() => {
    request.mockReset();
    list.mockResolvedValue({ data: { data: [{ name: 'declarant', title: 'Декларанты' }] } });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({ matches: false, media: query, addListener: vi.fn(), removeListener: vi.fn() }),
    });
  });

  function loadDocuments(canManageAccess: boolean, canWrite = true) {
    request.mockImplementation(async ({ url, data }) => {
      if (url === 'processDocuments:setFolderAccess') return { data: true };
      const inFolder = data.folderId === folder.id;
      return {
        data: {
          currentFolder: inFolder ? folder : null,
          breadcrumbs: inFolder ? [{ id: folder.id, title: folder.title }] : [],
          folders: inFolder ? [] : [folder],
          files: [],
          permissions: { canWrite, canDelete: true, canManageAccess },
        },
      };
    });
  }

  it('сохраняет настройки текущей папки из панели действий', async () => {
    loadDocuments(true);
    render(<ScopedDocuments requestScope={scope} />);

    fireEvent.click(await screen.findByRole('button', { name: /Декларантам/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Доступ к папке/ }));
    await screen.findByRole('dialog', { name: /Права папки «Декларантам»/ });
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Декларанты · Загрузка' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить права' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'processDocuments:setFolderAccess',
          data: {
            folderId: folder.id,
            grants: { rules: [{ kind: 'role', subject: 'declarant', rights: { write: false } }] },
          },
        }),
      ),
    );
  });

  it('объясняет запрет на загрузку, если просмотр документов ВЭД разрешён', async () => {
    loadDocuments(false, false);
    render(<ScopedDocuments requestScope={scope} />);
    await screen.findByText('У вас нет права загружать документы в разделе ВЭД.');
    expect(screen.getByRole('button', { name: /Загрузить/ })).toBeDisabled();
  });

  it.each([
    { canManageAccess: false, readOnly: false },
    { canManageAccess: true, readOnly: true },
  ])('скрывает действие по ограничениям блока или сервера (%s)', async ({ canManageAccess, readOnly }) => {
    loadDocuments(canManageAccess);
    render(<ScopedDocuments requestScope={scope} rootFolderId={folder.id} readOnly={readOnly} />);

    await screen.findByText('Документов пока нет');
    expect(screen.queryByRole('button', { name: /Доступ к папке/ })).not.toBeInTheDocument();
  });
});
