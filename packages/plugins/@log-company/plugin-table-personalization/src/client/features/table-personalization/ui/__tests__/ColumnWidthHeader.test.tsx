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
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FlowEngine, FlowModel } from '@nocobase/flow-engine';
import { describe, expect, it, vi } from 'vitest';
import type { TablePersonalization } from '../../../../../shared/contracts';
import type { PersonalizationApi } from '../../api/TablePersonalizationApi';
import { PersonalizationController } from '../../model/PersonalizationController';
import { ColumnWidthHeader } from '../ColumnWidthHeader';

function fixture() {
  const engine = new FlowEngine();
  const error = vi.fn();
  engine.context.defineProperty('api', { value: { auth: { role: 'reader' } } });
  engine.context.defineProperty('user', { value: { id: 'one' } });
  engine.context.defineProperty('acl', { value: { data: {} } });
  engine.context.defineProperty('message', { value: { error } });
  const table = new FlowModel({ uid: 'table', use: 'TableBlockModel', flowEngine: engine });
  const layout = { version: 1 as const, columnOrder: ['first'], hiddenColumnUids: [] };
  let data: TablePersonalization = {
    schemaSignature: 'a'.repeat(64),
    columns: [],
    resizableColumnUids: ['first'],
    settings: layout,
  };
  const api: PersonalizationApi = {
    get: vi.fn().mockImplementation(async () => data),
    save: vi.fn(),
    reset: vi.fn(),
    width: vi.fn().mockImplementation(async (_identity, uid, width) => {
      data = { ...data, settings: { ...layout, columnWidths: width === null ? {} : { [uid]: width } } };
      return data;
    }),
  };
  const controller = new PersonalizationController(api);
  const pageClick = vi.fn();
  const view = render(
    <div onClick={pageClick}>
      <table>
        <thead>
          <tr>
            <th>
              <ColumnWidthHeader
                table={table}
                controller={controller}
                columnUid="first"
                defaultWidth={150}
                title="Первый"
              >
                Штатный заголовок
              </ColumnWidthHeader>
            </th>
          </tr>
        </thead>
      </table>
      <button>Действие страницы</button>
    </div>,
  );
  return { api, controller, table, error, view, pageClick };
}

describe('personal column width interaction', () => {
  it('previews every mouse movement and saves once on release without blocking page controls', async () => {
    const { api, controller, pageClick } = fixture();
    const handle = await screen.findByRole('separator', { name: 'Изменить ширину колонки «Первый»' });
    expect(handle.parentElement?.tagName).toBe('TH');
    expect(handle).toHaveStyle({ right: '0px', top: '0px', bottom: '0px' });
    fireEvent.mouseDown(handle, { button: 0, clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 160 });
    fireEvent.mouseMove(document, { clientX: 210 });
    expect(controller.getWidth('first', 150)).toBe(260);
    expect(api.width).not.toHaveBeenCalled();
    fireEvent.mouseUp(document);
    await waitFor(() => expect(api.width).toHaveBeenCalledOnce());
    await waitFor(() => expect(controller.state.isSavingWidth).toBe(false));
    expect(api.width).toHaveBeenCalledWith({ tableUid: 'table', referencePath: [] }, 'first', 260, 'a'.repeat(64));
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
    fireEvent.click(handle);
    expect(pageClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Действие страницы' }));
    expect(pageClick).toHaveBeenCalledOnce();
  });

  it('cancels with Escape and cleans document handlers on unmount', async () => {
    const { api, controller, view } = fixture();
    const handle = await screen.findByRole('separator');
    fireEvent.mouseDown(handle, { button: 0, clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 500 });
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseUp(document);
    expect(api.width).not.toHaveBeenCalled();
    expect(controller.getWidth('first', 150)).toBe(150);
    fireEvent.mouseDown(handle, { button: 0, clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 200 });
    view.unmount();
    fireEvent.mouseUp(document);
    expect(api.width).not.toHaveBeenCalled();
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });

  it('supports accessible keyboard resizing, bounds and per-column reset', async () => {
    const { api, controller } = fixture();
    const handle = await screen.findByRole('separator');
    expect(handle).toHaveAttribute('aria-valuenow', '150');
    await act(async () => fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true }));
    expect(controller.getWidth('first', 150)).toBe(200);
    await act(async () => fireEvent.keyDown(handle, { key: 'Home' }));
    expect(controller.getWidth('first', 150)).toBe(50);
    await act(async () => fireEvent.keyDown(handle, { key: 'End' }));
    expect(controller.getWidth('first', 150)).toBe(3000);
    await act(async () => fireEvent.doubleClick(handle));
    expect(controller.getWidth('first', 150)).toBe(150);
    expect(api.width).toHaveBeenLastCalledWith({ tableUid: 'table', referencePath: [] }, 'first', null, 'a'.repeat(64));
    expect(screen.getByText('Штатный заголовок')).toBeInTheDocument();
  });

  it('reports a failed save, rolls back the preview and permits another drag', async () => {
    const { api, controller, error } = fixture();
    const handle = await screen.findByRole('separator');
    vi.mocked(api.width).mockRejectedValueOnce(new Error('offline'));
    fireEvent.mouseDown(handle, { button: 0, clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 200 });
    fireEvent.mouseUp(document);
    await waitFor(() => expect(error).toHaveBeenCalledOnce());
    expect(controller.getWidth('first', 150)).toBe(150);
    fireEvent.mouseDown(handle, { button: 0, clientX: 100 });
    fireEvent.mouseMove(document, { clientX: -200 });
    fireEvent.mouseUp(document);
    await waitFor(() => expect(controller.state.data?.settings?.columnWidths).toEqual({ first: 50 }));
  });
});
