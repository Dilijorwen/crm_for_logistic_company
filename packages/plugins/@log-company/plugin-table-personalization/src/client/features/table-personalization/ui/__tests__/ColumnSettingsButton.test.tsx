/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App, Button, ConfigProvider } from 'antd';
import { FlowEngine, FlowEngineProvider, FlowEngineGlobalsContextProvider } from '@nocobase/flow-engine';
import type { TablePersonalization } from '../../../../../shared/contracts';
import type { PersonalizationApi } from '../../api/TablePersonalizationApi';
import { PersonalizationController } from '../../model/PersonalizationController';
import { PersonalizedTableBlockModel } from '../../model/PersonalizedTableBlockModel';
import { ColumnSettingsButton } from '../ColumnSettingsButton';

vi.mock('@nocobase/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nocobase/client')>()),
  useACLContext: () => null,
  useCurrentUserContext: () => null,
}));

function fixture(isDesigner = false) {
  const data: TablePersonalization = {
    schemaSignature: 'a'.repeat(64),
    settings: null,
    columns: [
      { uid: 'first', title: 'Первый', fieldPath: 'first', fixed: 'normal' },
      { uid: 'second', title: 'Второй', fieldPath: 'second', fixed: 'normal' },
    ],
  };
  const api: PersonalizationApi = {
    get: vi.fn().mockResolvedValue(data),
    save: vi.fn().mockImplementation(async (_identity, settings) => ({ ...data, settings })),
    reset: vi.fn().mockResolvedValue(data),
    width: vi.fn().mockResolvedValue(data),
  };
  const controller = new PersonalizationController(api);
  const engine = new FlowEngine();
  engine.context.defineProperty('flowSettingsEnabled', { value: isDesigner });
  const model = new PersonalizedTableBlockModel({ uid: 'table', use: 'TableBlockModel', flowEngine: engine });
  Reflect.set(model, 'personalController', controller);
  vi.spyOn(model, 'getPersonalizationOwner').mockReturnValue('owner');
  vi.spyOn(model, 'getPersonalizableColumns').mockImplementation(() => controller.state.data?.columns || []);
  return { api, controller, model, data, engine };
}

function ToolbarHost({ model, onPageClick }: { model: PersonalizedTableBlockModel; onPageClick?: () => void }) {
  const [revision, setRevision] = React.useState(0);
  return (
    <>
      <Button onClick={onPageClick}>Действие страницы</Button>
      <Button onClick={() => setRevision((previous) => previous + 1)}>Пересоздать панель</Button>
      <ColumnSettingsButton key={revision} model={model} />
    </>
  );
}

function Harness({
  model,
  engine,
  onPageClick,
}: {
  model: PersonalizedTableBlockModel;
  engine: FlowEngine;
  onPageClick?: () => void;
}) {
  return (
    <div id="nocobase-app-container">
      <ConfigProvider>
        <App>
          <FlowEngineProvider engine={engine}>
            <FlowEngineGlobalsContextProvider>
              <ToolbarHost model={model} onPageClick={onPageClick} />
            </FlowEngineGlobalsContextProvider>
          </FlowEngineProvider>
        </App>
      </ConfigProvider>
    </div>
  );
}

async function openDialog(): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole('button', { name: 'Столбцы' }));
  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(dialog.querySelector('.ant-spin')).toBeNull());
  return dialog;
}

describe('column settings dialog', () => {
  it('allows selecting a readable collection field absent from the shared table', async () => {
    const { api, model, engine, data } = fixture();
    data.columns.push({
      uid: 'extra',
      title: 'Дополнительное поле',
      fieldPath: 'extra',
      fixed: 'normal',
      source: 'collection',
    });
    render(<Harness model={model} engine={engine} />);
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Поиск полей' }), {
      target: { value: 'Дополнительное' },
    });
    expect(within(dialog).queryByRole('checkbox', { name: /Первый/ })).not.toBeInTheDocument();
    const field = within(dialog).getByRole('checkbox', { name: /Дополнительное поле/ });
    expect(field).not.toBeChecked();
    fireEvent.click(field);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith(
        model.getPersonalizationIdentity(),
        { version: 1, columnOrder: ['first', 'second', 'extra'], hiddenColumnUids: [] },
        data.schemaSignature,
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('opens on the first click while loading and allows cancel before the request completes', async () => {
    const { api, model, engine, controller, data } = fixture();
    const pageAction = vi.fn();
    render(<Harness model={model} engine={engine} onPageClick={pageAction} />);
    await waitFor(() => expect(controller.state.isLoading).toBe(false));
    let complete!: (value: TablePersonalization) => void;
    vi.mocked(api.get).mockReturnValueOnce(
      new Promise<TablePersonalization>((resolve) => {
        complete = resolve;
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Столбцы' }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(controller.state.isLoading).toBe(true));
    await waitFor(() => expect(within(dialog).getByText('Мои столбцы')).toBeVisible());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await act(async () => {
      complete(data);
    });
    await waitFor(() => expect(controller.state.isLoading).toBe(false));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('.ant-modal-wrap')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Действие страницы' }));
    expect(pageAction).toHaveBeenCalledOnce();
  });

  it('keeps a single dialog and its draft when FlowEngine remounts the table toolbar', async () => {
    const { api, model, engine, controller, data } = fixture();
    render(<Harness model={model} engine={engine} />);
    await waitFor(() => expect(controller.state.isLoading).toBe(false));
    let complete!: (value: TablePersonalization) => void;
    vi.mocked(api.get).mockReturnValueOnce(
      new Promise<TablePersonalization>((resolve) => {
        complete = resolve;
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Столбцы' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Пересоздать панель' }));
    fireEvent.click(screen.getByRole('button', { name: 'Столбцы' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(api.get).toHaveBeenCalledTimes(2);
    await act(async () => {
      complete(data);
    });
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('checkbox', { name: 'Первый' });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Первый' }));
    fireEvent.click(screen.getByRole('button', { name: 'Пересоздать панель' }));
    expect(within(screen.getByRole('dialog')).getByRole('checkbox', { name: 'Первый' })).not.toBeChecked();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(api.save).toHaveBeenCalledOnce());
    await waitFor(() => expect(document.querySelector('.ant-modal-wrap')).toBeNull());
  });

  it('closes the view when the current owner changes', async () => {
    const { model, engine } = fixture();
    render(<Harness model={model} engine={engine} />);
    await openDialog();
    vi.mocked(model.getPersonalizationOwner).mockReturnValue('new-owner');
    fireEvent.click(screen.getByRole('button', { name: 'Пересоздать панель' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.querySelector('.ant-modal-wrap')).toBeNull();
  });

  it('saves visibility and keyboard-friendly ordering with the existing server signature', async () => {
    const { api, model, engine } = fixture();
    render(<Harness model={model} engine={engine} />);
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Первый' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Выше: Второй' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith(
        { tableUid: 'table', referencePath: [] },
        { version: 1, columnOrder: ['second', 'first'], hiddenColumnUids: ['first'] },
        'a'.repeat(64),
      ),
    );
  });

  it('does not save canceled changes and resets only personal settings', async () => {
    const { api, model, engine } = fixture();
    render(<Harness model={model} engine={engine} />);
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Первый' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(api.save).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const reopened = await openDialog();
    expect(within(reopened).getByRole('checkbox', { name: 'Первый' })).toBeChecked();
    fireEvent.click(within(reopened).getByRole('button', { name: 'Сбросить мои настройки' }));
    await waitFor(() => expect(api.reset).toHaveBeenCalledWith({ tableUid: 'table', referencePath: [] }));
  });

  it('restores a personally hidden column with its original UID', async () => {
    const { api, model, data, engine } = fixture();
    vi.mocked(api.get).mockResolvedValue({
      ...data,
      settings: { version: 1, columnOrder: ['first', 'second'], hiddenColumnUids: ['first'] },
    });
    render(<Harness model={model} engine={engine} />);
    const dialog = await openDialog();
    expect(within(dialog).getByRole('checkbox', { name: 'Первый' })).not.toBeChecked();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Первый' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith(
        { tableUid: 'table', referencePath: [] },
        { version: 1, columnOrder: ['first', 'second'], hiddenColumnUids: [] },
        'a'.repeat(64),
      ),
    );
  });

  it('keeps the draft after a save error and allows retry', async () => {
    const { api, model, engine } = fixture();
    vi.mocked(api.save).mockRejectedValueOnce(new Error('offline'));
    render(<Harness model={model} engine={engine} />);
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Первый' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));
    await within(dialog).findByText('Не удалось сохранить настройки столбцов. Изменения в окне сохранены');
    expect(within(dialog).getByRole('checkbox', { name: 'Первый' })).not.toBeChecked();
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /Сохранить/ })).not.toHaveClass('ant-btn-loading'),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: /Сохранить/ }));
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(2));
  });

  it('shows loading errors and reloads available columns on retry', async () => {
    const { api, model, data, engine } = fixture();
    vi.mocked(api.get).mockRejectedValue(new Error('offline'));
    render(<Harness model={model} engine={engine} />);
    const dialog = await openDialog();
    await within(dialog).findByText('Не удалось загрузить настройки столбцов. Повторите попытку');
    expect(within(dialog).getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    vi.mocked(api.get).mockResolvedValue(data);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Повторить' }));
    await within(dialog).findByRole('checkbox', { name: 'Первый' });
  });

  it('does not display personalization controls in the designer', () => {
    const { model, engine } = fixture(true);
    render(<Harness model={model} engine={engine} />);
    expect(screen.queryByRole('button', { name: 'Столбцы' })).not.toBeInTheDocument();
  });
});
