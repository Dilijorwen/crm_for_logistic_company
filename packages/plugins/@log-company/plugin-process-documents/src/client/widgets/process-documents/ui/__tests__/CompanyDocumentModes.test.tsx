/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { FlowContext, SingleRecordResource, type Collection } from '@nocobase/flow-engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcessDocumentsBlock } from '../ProcessDocumentsBlock';
import type { DocumentFormBinding } from '../FormFolderUpload';

const { request, get } = vi.hoisted(() => ({ request: vi.fn(), get: vi.fn() }));
const client = { request, resource: () => ({ get }) };
vi.mock('@nocobase/client', () => ({ useAPIClient: () => client, css: () => '' }));
vi.mock(
  '@log-company/plugin-process-governance/client',
  async () =>
    import('../../../../../../../plugin-process-governance/src/client/shared/lib/process-context/recordContext'),
);
vi.mock('../../model/useProcessTarget', () => ({}));

const modelContext = { collection: 'our_companies', filterByTk: '10' };
const collection = {
  getFields: () => [{ name: 'documents', title: 'Документы', interface: 'attachment', target: 'attachments' }],
} as unknown as Collection;
const props = { modelContext, getCollection: () => collection, canUpdateField: async () => true };
const folder = { id: '55', title: 'По запросам' };
const corporateFolder = { id: '56', title: 'Учредительные документы' };
const contractFolder = { id: '57', title: 'Контракт' };
const permissions = { canRead: true, canWrite: true, canDelete: true, canManageAccess: true };

describe('Режимы документов в компании', () => {
  beforeEach(() => {
    request.mockReset();
    get.mockReset();
    request.mockImplementation(async ({ url, data }) => ({
      data:
        url === 'processDocuments:attachmentPermissions'
          ? { canRead: true, canWrite: false, canDelete: false }
          : url === 'processDocumentDrafts:shipmentPermissions'
            ? { data: { canRead: true, canWrite: true } }
            : url === 'processDocumentDrafts:stage'
              ? { data: { token: 'batch', files: [{ name: 'Договор.txt', size: 4 }] } }
              : url === 'processDocumentDrafts:discard'
                ? true
                : {
                    currentFolder:
                      data?.folderId === '56' ? corporateFolder : data?.folderId === '57' ? contractFolder : folder,
                    breadcrumbs: [
                      folder,
                      ...(data?.folderId === '56'
                        ? [corporateFolder]
                        : data?.folderId === '57'
                          ? [contractFolder]
                          : []),
                    ],
                    folders:
                      data?.folderId === null
                        ? [folder]
                        : data?.companyId && data?.folderId === '55'
                          ? [corporateFolder, contractFolder]
                          : [],
                    files: [{ id: '12', title: data?.folderId === '57' ? 'Контракт.pdf' : 'Устав.pdf' }],
                    permissions,
                  },
    }));
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({ matches: false, media: query, addListener: vi.fn(), removeListener: vi.fn() }),
    });
  });

  it('работает с отдельной папкой выбранной поставки и загружает папку без сохранения рейса', async () => {
    const { container, rerender } = render(<ProcessDocumentsBlock shipmentId="42" />);
    await screen.findByRole('button', { name: 'Устав.pdf' });
    expect(screen.getByRole('heading', { name: 'Документы поставки' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Документы поставки' })).toBeNull();

    const row = await screen.findByRole('button', { name: folder.title });
    expect(screen.queryByRole('button', { name: /Загрузить/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Новая папка' })).not.toBeInTheDocument();
    fireEvent.click(row);
    expect(await screen.findByRole('button', { name: /Загрузить/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Новая папка' })).toBeVisible();
    const folderInput = container.querySelector('input[webkitdirectory]');
    if (!folderInput) throw new Error('Не найден выбор папки.');
    const file = new File(['test'], 'Договор.txt');
    Object.defineProperty(file, 'webkitRelativePath', { value: 'Скан/Договор.txt' });
    fireEvent.change(folderInput, { target: { files: [file] } });
    const upload = request.mock.calls.find(([config]) => config.url === 'processDocuments:uploadFiles')?.[0];
    const query = upload?.data;
    expect(query?.get('shipmentId')).toBe('42');
    expect(query?.get('folderId')).toBe(folder.id);
    expect(JSON.parse(query?.get('filePaths'))).toEqual(['Скан/Договор.txt']);

    fireEvent.click(screen.getByRole('button', { name: 'К списку файлов' }));
    rerender(<ProcessDocumentsBlock shipmentId="43" />);
    await screen.findByRole('button', { name: 'Устав.pdf' });
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({ url: 'processDocuments:list', data: { shipmentId: '43', folderId: null } }),
    );
  });

  it.each(['upload', 'view'] as const)('показывает заголовок сохранённой поставки в режиме %s', async (folderMode) => {
    render(
      <ProcessDocumentsBlock folderMode={folderMode} modelContext={{ collection: 'shipments', filterByTk: '42' }} />,
    );
    await screen.findByRole('button', { name: 'Устав.pdf' });
    expect(screen.getByRole('heading', { name: 'Документы поставки' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Документы' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Документы поставки' })).toBeNull();
  });

  it('показывает заголовок документов рейса отдельно от навигации по папкам', async () => {
    render(
      <ProcessDocumentsBlock folderMode="view" modelContext={{ collection: 'transport_runs', filterByTk: '87' }} />,
    );
    expect(await screen.findByRole('heading', { name: 'Документы рейса' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Документы рейса' })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: folder.title }));
    fireEvent.click(await screen.findByRole('button', { name: 'К списку файлов' }));
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({ url: 'processDocuments:list', data: { runId: '87', folderId: null } }),
    );
  });

  it.each([
    { collection: 'shipments', filterByTk: '42', canDelete: true },
    { collection: 'transport_runs', filterByTk: '87', canDelete: true },
    { collection: 'transport_runs', filterByTk: '87', canDelete: false },
  ])(
    'показывает удаление в карточке ($collection, право $canDelete) по ответу сервера',
    async ({ collection, filterByTk, canDelete }) => {
      request.mockResolvedValue({
        data: {
          breadcrumbs: [],
          folders: [],
          files: [{ id: '12', title: 'Документ.pdf' }],
          permissions: { canWrite: false, canRename: true, canDelete },
        },
      });
      render(<ProcessDocumentsBlock folderMode="view" modelContext={{ collection, filterByTk }} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Действия: Документ.pdf' }));
      await screen.findByRole('menuitem', { name: 'Скачать' });
      expect(!!screen.queryByRole('menuitem', { name: 'Удалить' })).toBe(canDelete);
      expect(screen.queryByRole('menuitem', { name: 'Переименовать' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Загрузить/ })).not.toBeInTheDocument();
    },
  );

  it('находит папку компании без настроек и открывает её только на чтение', async () => {
    render(<ProcessDocumentsBlock {...props} folderMode="view" />);
    expect(await screen.findByRole('button', { name: 'Устав.pdf' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Учредительные документы' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Загрузить|Удалить|Новая папка|Доступ к папке/ })).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'processDocuments:list',
        data: { companyId: '10', companyArea: 'company', folderId: '56' },
      }),
    );
  });

  it('держит выбранные файлы в черновике создания и удаляет его при закрытии формы', async () => {
    const resource = {
      getMeta: () => undefined,
      getFilterByTk: () => undefined,
      getResourceName: () => 'our_companies',
      isNewRecord: true,
      addRequestHeader: vi.fn(),
      removeRequestHeader: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
    const form = { resource, model: { emitter: { on: vi.fn(), off: vi.fn() } } };
    const { container, unmount } = render(
      <ProcessDocumentsBlock
        folderMode="upload"
        modelContext={{ collection: 'our_companies' }}
        findForm={() => form as unknown as DocumentFormBinding}
      />,
    );
    await screen.findByRole('button', { name: 'Файлы' });
    expect(screen.getByRole('button', { name: 'Папка' })).toBeTruthy();
    const input = container.querySelector('input[type="file"][multiple]');
    if (!input) throw new Error('Не найдено поле выбора файлов');
    fireEvent.change(input, { target: { files: [new File(['test'], 'Договор.txt')] } });
    expect(
      await within(await screen.findByRole('list', { name: 'Файлы, ожидающие сохранения' })).findByText('Договор.txt'),
    ).toBeTruthy();
    expect(resource.addRequestHeader.mock.calls).toEqual([
      ['X-Log-Company-Form-Documents', 'pending'],
      ['X-Log-Company-Form-Documents', 'batch'],
    ]);
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ url: 'processDocuments:uploadFiles' }));
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'processDocumentDrafts:stage',
        params: { resource: 'our_companies', recordId: null },
      }),
    );
    unmount();
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'processDocumentDrafts:discard',
        data: { tokens: ['batch'] },
      }),
    );
  });

  it('отправляет черновик только со штатным сохранением нового рейса и оставляет его после ошибки', async () => {
    request.mockResolvedValueOnce({ data: { data: { canRead: true, canWrite: true } } }).mockResolvedValueOnce({
      data: { data: { token: 'batch', files: [{ name: 'Машина/Документы/Договор.txt', size: 4 }] } },
    });

    const resource = new SingleRecordResource(new FlowContext()).setResourceName('transport_runs');
    resource.isNewRecord = true;
    const saveRequest = vi
      .fn()
      .mockRejectedValueOnce(new Error('Исправьте данные рейса.'))
      .mockResolvedValueOnce({ data: { data: { id: '99' } } });
    resource.setAPIClient({ request: saveRequest } as unknown as Parameters<typeof resource.setAPIClient>[0]);
    const form = { resource, model: { emitter: { on: vi.fn(), off: vi.fn() } } };
    const { container } = render(
      <ProcessDocumentsBlock
        folderMode="upload"
        modelContext={{ collection: 'transport_runs' }}
        findForm={() => form as unknown as DocumentFormBinding}
      />,
    );
    expect(await screen.findByRole('button', { name: /Загрузить/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Новая папка' })).toBeVisible();
    expect(screen.getByText('Документы рейса')).toBeVisible();
    const file = new File(['test'], 'Договор.txt');
    Object.defineProperty(file, 'webkitRelativePath', { value: 'Машина/Документы/Договор.txt' });
    const input = container.querySelector('input[webkitdirectory]');
    if (!input) throw new Error('Не найден выбор папки.');
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Машина' }));
    fireEvent.click(screen.getByRole('button', { name: 'Документы' }));
    expect(screen.queryByRole('button', { name: '..', exact: true })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Машина' }));
    fireEvent.click(screen.getByRole('button', { name: 'Документы' }));
    expect(screen.getByText('Договор.txt')).toBeVisible();
    const staged = request.mock.calls.find(([config]) => config.url === 'processDocumentDrafts:stage')?.[0];
    expect(staged.params).toEqual({ resource: 'transport_runs', recordId: null });
    expect(JSON.parse(staged.data.get('filePaths'))).toEqual(['Машина/Документы/Договор.txt']);
    expect(saveRequest).not.toHaveBeenCalled();
    await act(async () => {
      await expect(resource.save({ test: 'рейс' })).rejects.toBeDefined();
    });
    expect(screen.getByText('Договор.txt')).toBeTruthy();
    await act(async () => {
      await resource.save({ test: 'рейс' });
    });
    expect(saveRequest.mock.calls.map(([config]) => config.headers['X-Log-Company-Form-Documents'])).toEqual([
      'batch',
      'batch',
    ]);
    expect(screen.queryByText('Договор.txt')).toBeNull();
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ url: 'processDocumentDrafts:discard' }));
  });

  it('показывает действия в корне документов сохранённого рейса и внутри папок', async () => {
    render(
      <ProcessDocumentsBlock folderMode="upload" modelContext={{ collection: 'transport_runs', filterByTk: '99' }} />,
    );
    expect(await screen.findByRole('heading', { name: 'Документы рейса' })).toBeVisible();
    const folderButton = await screen.findByRole('button', { name: folder.title });
    fireEvent.click(await screen.findByRole('button', { name: /Загрузить/ }));
    expect(await screen.findByRole('menuitem', { name: 'Файлы' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Папку' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Новая папка' })).toBeVisible();

    fireEvent.click(folderButton);
    expect(await screen.findByRole('button', { name: 'К списку файлов' })).toBeVisible();
    expect(await screen.findByRole('button', { name: /Загрузить/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Новая папка' })).toBeVisible();
  });

  it('не подменяет отсутствующую папку корнем компании', async () => {
    request.mockResolvedValueOnce({
      data: {
        breadcrumbs: [],
        folders: [],
        files: [{ id: '15', title: 'Файл из корня.pdf' }],
        permissions,
      },
    });
    render(<ProcessDocumentsBlock {...props} folderMode="view" />);
    expect(await screen.findByText(/Папка «По запросу» отсутствует или недоступна/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Файл из корня.pdf' })).toBeNull();
  });

  it('показывает основное вложение сохранённого контракта', async () => {
    get.mockResolvedValue({
      data: { data: { id: '40', documents: [{ id: '3', title: 'Контракт', extname: '.pdf' }] } },
    });
    render(
      <ProcessDocumentsBlock
        {...props}
        folderMode="view"
        modelContext={{ collection: 'contracts', filterByTk: '40' }}
      />,
    );
    expect(await screen.findByRole('button', { name: 'Контракт.pdf' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Устав.pdf' })).toBeNull();
    expect(get).toHaveBeenCalledWith(
      expect.objectContaining({
        filterByTk: '40',
        appends: expect.arrayContaining(['documents']),
      }),
    );
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'processDocuments:attachmentPermissions',
        data: { resource: 'contracts.documents', recordId: '40' },
      }),
    );
  });

  it('проверяет право просмотра до получения основных вложений контракта', async () => {
    request.mockResolvedValue({ data: { canRead: false, canWrite: false, canDelete: false } });
    render(
      <ProcessDocumentsBlock
        {...props}
        folderMode="view"
        modelContext={{ collection: 'contracts', filterByTk: '40' }}
      />,
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: 'processDocuments:attachmentPermissions' })),
    );
    expect(get).not.toHaveBeenCalled();
  });

  it('без выбранного режима открывает «По запросу» для просмотра, а не старый интерфейс компании', async () => {
    render(<ProcessDocumentsBlock {...props} />);
    expect(await screen.findByRole('heading', { name: 'Учредительные документы' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Загрузить|Удалить|Обновить/ })).toBeNull();
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'processDocuments:list',
        data: { companyId: '10', companyArea: 'company', folderId: '56' },
      }),
    );
  });

  it('принимает файл при перетаскивании прямо на список сохранённых документов', async () => {
    const resource = new SingleRecordResource(new FlowContext()).setResourceName('our_companies');
    resource.setFilterByTk('10');
    const form = { resource, model: { emitter: { on: vi.fn(), off: vi.fn() } } };
    render(
      <ProcessDocumentsBlock {...props} folderMode="upload" findForm={() => form as unknown as DocumentFormBinding} />,
    );
    const list = await screen.findByRole('region', { name: 'Список документов' });
    expect(within(list).getByRole('button', { name: 'Файлы' })).toBeTruthy();
    const saved = await within(list).findByRole('button', { name: 'Устав.pdf' });
    expect(screen.queryByRole('button', { name: /Обновить/ })).toBeNull();
    fireEvent.drop(saved, {
      dataTransfer: { items: [], types: ['Files'], files: [new File(['test'], 'Договор.txt')] },
    });
    expect(await within(list).findByText('Договор.txt')).toBeTruthy();
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'processDocumentDrafts:stage',
        params: { resource: 'our_companies', recordId: '10' },
      }),
    );
  });

  it('проверяет ВЭД выбранной компании до показа блока в новой поставке', async () => {
    request.mockResolvedValueOnce({ data: { data: { canRead: false, canWrite: false } } });
    const resource = new SingleRecordResource(new FlowContext()).setResourceName('shipments');
    resource.isNewRecord = true;
    const form = { resource, model: { context: { formValues: { company: { id: '10' } } } } };
    render(
      <ProcessDocumentsBlock
        modelContext={{ collection: 'shipments' }}
        folderMode="upload"
        findForm={() => form as unknown as DocumentFormBinding}
      />,
    );
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'processDocumentDrafts:shipmentPermissions',
          params: { resource: 'shipments', recordId: null, companyId: '10' },
        }),
      );
      expect(screen.queryByLabelText('Проверка прав на документы')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('region', { name: 'Список документов' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Папка' })).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('ставит пустую папку, сброшенную на папку поставки, в черновик с её ID', async () => {
    const resource = new SingleRecordResource(new FlowContext()).setResourceName('shipments');
    resource.setFilterByTk('42');
    const form = { resource, model: { emitter: { on: vi.fn(), off: vi.fn() } } };
    render(
      <ProcessDocumentsBlock
        {...props}
        modelContext={{ collection: 'shipments', filterByTk: '42' }}
        folderMode="upload"
        findForm={() => form as unknown as DocumentFormBinding}
      />,
    );
    const row = await screen.findByRole('button', { name: folder.title });
    const entry = { name: 'Пустая', isDirectory: true, createReader: () => ({ readEntries: (load) => load([]) }) };
    fireEvent.drop(row, {
      dataTransfer: { items: [{ webkitGetAsEntry: () => entry }], types: ['Files'], files: [] },
    });
    await waitFor(() => {
      const staged = request.mock.calls.find(([config]) => config.url === 'processDocumentDrafts:stage')?.[0];
      expect(staged?.params).toEqual({ resource: 'shipments', recordId: '42', folderId: folder.id });
      expect(staged?.data.get('emptyFolders')).toBe(JSON.stringify(['Пустая']));
    });
    expect(request.mock.calls.some(([config]) => config.url === 'processDocuments:uploadFiles')).toBe(false);
  });
});
