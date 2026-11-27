/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { ConfigProvider, theme } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScopedDocuments } from '../ScopedDocuments';
import { CompanyFilesBlock } from '../CompanyFilesBlock';
import { DocumentCatalogContext } from '../DocumentCatalogContext';
import { DocumentSectionAccessDialog } from '../DocumentSectionAccessDialog';
import { ProcessDocumentsApi } from '../../../../entities/process-document';
import type { DocumentAccessRule } from '../../../../../contracts/processDocuments';

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
      if (url === 'processDocuments:getFolderConstraints') return { data: { constraints: [] } };
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

  function renderCatalog(readOnly = false) {
    return render(
      <DocumentCatalogContext.Provider
        value={{
          path: ['Компании', 'Агробизнес', 'ВЭД', 'Рейс №87'],
          manageAccess: true,
          onCompanyFolderLocationChange: vi.fn(),
        }}
      >
        <ScopedDocuments requestScope={scope} readOnly={readOnly} />
      </DocumentCatalogContext.Provider>,
    );
  }

  it('показывает права, загрузку и новую папку в одной группе рядом с путём', async () => {
    loadDocuments(true);
    const regular = request.getMockImplementation();
    request.mockImplementation((config) => {
      if (config.url === 'processDocuments:sectionPermissions') {
        return Promise.resolve({ data: { sections: { company: true }, canManageAccess: true } });
      }
      return regular?.(config);
    });
    render(<CompanyFilesBlock root={{ type: 'company', company: { id: '10', title: 'Агробизнес' } }} />);
    const actions = screen.getByRole('group', { name: 'Действия файлового менеджера' });
    expect(await within(actions).findByRole('button', { name: /Права на документы/ })).toBeVisible();
    expect(await within(actions).findByRole('button', { name: /Загрузить/ })).toBeVisible();
    expect(within(actions).getByRole('button', { name: 'Новая папка' })).toBeVisible();
    expect(within(actions).queryByRole('button', { name: 'Действия с текущей папкой' })).toBeNull();
    expect(within(actions).getByRole('button', { name: 'Поиск по файлам' })).toBeVisible();
    expect(within(actions).getAllByRole('button')).toHaveLength(4);
    const path = screen.getByRole('navigation', { name: 'Путь к документам' });
    expect(actions.parentElement).toBe(path.parentElement);
    fireEvent.click(screen.getByRole('button', { name: folder.title }));
    await waitFor(() => expect(within(actions).queryByRole('button', { name: /Права на документы/ })).toBeNull());
  });

  it('открывает права конкретной папки через меню строки', async () => {
    loadDocuments(true);
    renderCatalog(true);
    const row = await screen.findByRole('button', { name: folder.title });
    expect(screen.queryByRole('button', { name: 'Настроить доступ' })).toBeNull();
    fireEvent.contextMenu(row, { clientX: 20, clientY: 40 });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Права папки' }));
    await waitFor(() => expect(screen.getByText('Компании / Агробизнес / ВЭД / Рейс №87 / Декларантам')).toBeVisible());
    expect(screen.queryByRole('button', { name: 'Доступ к папке' })).toBeNull();
  });

  it('показывает в общих правах только типовые папки, а в компании добавляет её папки первого уровня', async () => {
    request.mockImplementation(async ({ url }) => ({
      data:
        url === 'processDocuments:list'
          ? {
              breadcrumbs: [],
              files: [],
              folders: [
                { id: '60', title: 'Внутренний архив' },
                { id: '61', title: 'По запросу' },
              ],
              permissions: { canWrite: true, canDelete: true },
            }
          : { rules: [], inherited: [] },
    }));
    const api = new ProcessDocumentsApi(client);
    const handlers = { onClose: vi.fn(), onSaved: vi.fn() };
    const { unmount } = render(<DocumentSectionAccessDialog api={api} {...handlers} />);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Папка первого уровня' }));
    await waitFor(() => expect(screen.getByText('По запросу')).toBeVisible());
    expect(screen.queryByText('Внутренний архив')).toBeNull();
    expect(screen.queryByText('Учредительные документы')).toBeNull();
    expect(request.mock.calls.some(([config]) => config.url === 'processDocuments:list')).toBe(false);
    unmount();
    render(<DocumentSectionAccessDialog api={api} company={{ id: '10', title: 'Агробизнес' }} {...handlers} />);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Папка первого уровня' }));
    await waitFor(() => expect(screen.getByText('Внутренний архив')).toBeVisible());
    expect(screen.getAllByText('По запросу')).toHaveLength(1);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'processDocuments:list',
        data: { companyId: '10', companyArea: 'company', folderId: null },
      }),
    );
  });

  it('сохраняет явное разрешение удаления ВЭД для менеджера и показывает его после открытия окна', async () => {
    let rules: DocumentAccessRule[] = [{ kind: 'role', subject: 'manager', rights: { rename: false } }];
    list.mockResolvedValue({ data: { data: [{ name: 'manager', title: 'Менеджер' }] } });
    request.mockImplementation(async ({ url, data }) => {
      if (url === 'processDocuments:setSectionAccess') {
        rules = data.rules;
        return { data: true };
      }
      return { data: { rules, inherited: [] } };
    });

    const api = new ProcessDocumentsApi(client);
    const handlers = { onClose: vi.fn(), onSaved: vi.fn() };
    const { unmount } = render(<DocumentSectionAccessDialog api={api} {...handlers} />);
    const checkbox = await screen.findByRole('checkbox', { name: 'Менеджер · Удаление' });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить права' }));
    await waitFor(() => expect(handlers.onSaved).toHaveBeenCalledOnce());
    expect(rules).toEqual([{ kind: 'role', subject: 'manager', rights: { rename: false, delete: true } }]);
    unmount();
    render(<DocumentSectionAccessDialog api={api} {...handlers} />);
    expect(await screen.findByRole('checkbox', { name: 'Менеджер · Удаление' })).toBeChecked();
  });

  it('отправляет вложенный файл и пустую папку перетаскиванием в одном запросе', async () => {
    loadDocuments(false);
    renderCatalog();
    const list = await screen.findByRole('region', { name: 'Список документов' });
    await screen.findByRole('button', { name: folder.title });
    const file = new File(['копия'], 'Акт.txt');
    const fileEntry = { name: file.name, isFile: true, file: (load: (file: File) => void) => load(file) };
    const empty = { name: 'Архив', isDirectory: true, createReader: () => ({ readEntries: (load) => load([]) }) };
    const pages = [[fileEntry, empty], []];
    const directory = {
      name: 'Сканы',
      isDirectory: true,
      createReader: () => ({ readEntries: (load) => load(pages.shift() ?? []) }),
    };
    fireEvent.drop(list, {
      dataTransfer: { types: ['Files'], files: [], items: [{ webkitGetAsEntry: () => directory }] },
    });
    await waitFor(() => {
      const upload = request.mock.calls.find(([config]) => config.url === 'processDocuments:uploadFiles')?.[0];
      expect(JSON.parse(upload?.data.get('filePaths'))).toEqual(['Сканы/Акт.txt']);
      expect(upload?.data.get('emptyFolders')).toBe(JSON.stringify(['Сканы/Архив']));
      expect(upload?.data.get('runId')).toBe('87');
    });
  });

  it('блокирует перетаскивание и скрывает загрузку в каталоге для чтения', async () => {
    loadDocuments(true);
    renderCatalog(true);
    await screen.findByRole('button', { name: folder.title });
    fireEvent.drop(screen.getByRole('region', { name: 'Список документов' }), {
      dataTransfer: { types: ['Files'], files: [new File(['test'], 'Акт.txt')], items: [] },
    });
    expect(screen.queryByRole('button', { name: 'Загрузить' })).toBeNull();
    expect(request.mock.calls.some(([config]) => config.url === 'processDocuments:uploadFiles')).toBe(false);
  });

  it.each([
    { destination: 'list', folderId: null, canWrite: true, foldersOnly: false, accepted: true },
    { destination: 'folder', folderId: folder.id, canWrite: true, foldersOnly: false, accepted: true },
    { destination: 'folder', folderId: folder.id, canWrite: false, foldersOnly: false, accepted: false },
    { destination: 'folder', folderId: folder.id, canWrite: true, foldersOnly: true, accepted: true },
    { destination: 'folder', folderId: folder.id, canWrite: false, foldersOnly: true, accepted: false },
    { destination: 'list', folderId: null, canWrite: true, foldersOnly: true, accepted: false },
  ])(
    'различает сброс в список поставки и на папку ($destination, право $canWrite, только папки $foldersOnly)',
    async ({ destination, folderId, canWrite, foldersOnly, accepted }) => {
      request.mockResolvedValue({
        data: {
          breadcrumbs: [],
          folders: [{ ...folder, canWrite }],
          files: [],
          permissions: { canWrite: true, canDelete: false },
        },
      });
      render(<ScopedDocuments requestScope={{ shipmentId: '38' }} uploadInsideFoldersOnly={foldersOnly} />);
      const row = await screen.findByRole('button', { name: folder.title });
      const target = destination === 'folder' ? row : screen.getByRole('region', { name: 'Список документов' });
      const file = new File(['копия'], 'Акт.txt');
      fireEvent.drop(target, { dataTransfer: { types: ['Files'], files: [file], items: [] } });
      const uploads = () => request.mock.calls.filter(([config]) => config.url === 'processDocuments:uploadFiles');
      if (!accepted) {
        expect(uploads()).toHaveLength(0);
        return;
      }
      await waitFor(() => {
        expect(uploads()).toHaveLength(1);
        expect(uploads()[0][0].data.get('folderId')).toBe(folderId);
        expect(uploads()[0][0].data.get('shipmentId')).toBe('38');
      });
    },
  );

  it.each([
    { type: 'run', canDelete: true, readOnly: false, showsDelete: true },
    { type: 'shipment', canDelete: true, readOnly: false, showsDelete: true },
    { type: 'shipment', canDelete: false, readOnly: false, showsDelete: false },
    { type: 'run', canDelete: true, readOnly: true, showsDelete: true },
    { type: 'shipment', canDelete: false, readOnly: true, showsDelete: false },
  ])(
    'учитывает права удаления в каталоге ВЭД ($type, право $canDelete, просмотр $readOnly)',
    async ({ type, canDelete, readOnly, showsDelete }) => {
      const file = { id: '18', title: 'Инвойс.pdf' };
      let files = [file];
      request.mockImplementation(async ({ url }) => {
        if (url === 'processDocuments:deleteFile') {
          files = [];
          return { data: true };
        }
        return {
          data: {
            breadcrumbs: [],
            folders: [],
            files,
            permissions: { canWrite: type === 'run', canDelete, canRename: true },
          },
        };
      });
      const root =
        type === 'run'
          ? ({ type: 'run', run: { id: '87', title: 'Рейс №87' } } as const)
          : ({ type: 'shipment', shipment: { id: '42', title: 'Поставка №42' } } as const);
      render(<CompanyFilesBlock root={root} readOnly={readOnly} />);

      fireEvent.click(await screen.findByRole('button', { name: 'Действия: Инвойс.pdf' }));
      await screen.findByRole('menuitem', { name: 'Скачать' });
      expect(screen.queryByRole('button', { name: /Загрузить/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Переименовать' })).not.toBeInTheDocument();
      if (!showsDelete) {
        expect(screen.queryByRole('menuitem', { name: 'Удалить' })).not.toBeInTheDocument();
        return;
      }

      fireEvent.click(screen.getByRole('menuitem', { name: 'Удалить' }));
      const confirmation = await screen.findByRole('dialog');
      await waitFor(() => expect(within(confirmation).getByText('Удалить файл «Инвойс.pdf»?')).toBeVisible());
      expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ url: 'processDocuments:deleteFile' }));
      fireEvent.click(within(confirmation).getByRole('button', { name: 'Удалить' }));
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Инвойс.pdf' })).not.toBeInTheDocument());
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'processDocuments:deleteFile',
          data: expect.objectContaining({ documentId: file.id }),
        }),
      );
    },
  );

  it('открывает пустую ветку «По запросу» из папки компании до загрузки файлов', async () => {
    request.mockResolvedValue({
      data: {
        breadcrumbs: [],
        folders: [],
        files: [],
        permissions: { canWrite: false, canDelete: false },
        emptyRequestFolders: ['По запросу'],
      },
    });
    render(<ScopedDocuments requestScope={{ companyId: '10', companyArea: 'company' }} showRequestFolders />);
    fireEvent.click(await screen.findByRole('button', { name: 'По запросу' }));
    expect(screen.getByRole('button', { name: 'Учредительные документы' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Контракт' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Учредительные документы' }));
    expect(screen.getByText('Учредительные документы')).toBeVisible();
    expect(screen.getByText('Папка пуста')).toBeVisible();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('открывает создание папки с темой текущей формы и отправляет название', async () => {
    loadDocuments(false);
    const background = '#263548';
    render(
      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorBgElevated: background } }}>
        <ScopedDocuments requestScope={scope} />
      </ConfigProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Новая папка' }));
    const dialog = await screen.findByRole('dialog');
    const modalContent = dialog.querySelector('.ant-modal-content');
    if (!modalContent) throw new Error('Не найдена панель диалога.');
    expect(getComputedStyle(modalContent).backgroundColor).toBe('rgb(38, 53, 72)');
    fireEvent.change(screen.getByRole('textbox', { name: 'Название папки' }), { target: { value: 'Скан-копии' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'processDocuments:createFolder',
          data: { ...scope, parentFolderId: null, title: 'Скан-копии' },
        }),
      ),
    );
  });

  it('сохраняет настройки текущей папки из панели действий', async () => {
    loadDocuments(true);
    render(<ScopedDocuments requestScope={scope} />);

    fireEvent.click(await screen.findByRole('button', { name: folder.title }));
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

  it('не показывает кнопку удаления у папки с отдельным запретом', async () => {
    request.mockResolvedValue({
      data: {
        breadcrumbs: [],
        folders: [
          { ...folder, canDelete: false },
          { id: '56', title: 'Доступная папка', canDelete: true },
        ],
        files: [],
        permissions: { canWrite: false, canDelete: true },
      },
    });
    render(<ScopedDocuments requestScope={scope} />);
    expect(await screen.findByRole('button', { name: 'Удалить папку «Доступная папка»' })).toBeVisible();
    expect(screen.queryByRole('button', { name: `Удалить папку «${folder.title}»` })).not.toBeInTheDocument();
  });

  it.each([
    { canManageAccess: false, readOnly: false },
    { canManageAccess: true, readOnly: true },
  ])('скрывает действие по ограничениям блока или сервера (%s)', async ({ canManageAccess, readOnly }) => {
    loadDocuments(canManageAccess);
    render(<ScopedDocuments requestScope={scope} rootFolderId={folder.id} readOnly={readOnly} />);

    await screen.findByText('Папка пуста');
    expect(screen.queryByRole('button', { name: /Доступ к папке/ })).not.toBeInTheDocument();
  });
});
