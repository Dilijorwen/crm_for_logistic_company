/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from 'antd';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceDeletionPage } from '../WorkspaceDeletionPage';

const { runs, shipments, remove, notify, client } = vi.hoisted(() => ({
  runs: vi.fn(),
  shipments: vi.fn(),
  remove: vi.fn(),
  notify: vi.fn(),
  client: {},
}));

vi.mock('@nocobase/client', () => ({
  DataSourceProvider: ({ children }: { children: React.ReactNode }) => children,
  useAPIClient: () => client,
  useApp: () => ({ flowEngine: {} }),
}));
vi.mock('../../../../features/workspace-actions', () => ({
  useWorkspaceDeletionPermissions: () => ({
    canOpen: true,
    canReadRuns: true,
    canReadShipments: true,
    canDeleteRun: () => true,
    canDeleteShipment: () => true,
  }),
}));
vi.mock('../../../../shared/lib', () => ({ notifyWorkspaceChanged: notify }));
vi.mock('../../api/WorkspaceDeletionApi', () => ({
  deletionPageSize: 9,
  WorkspaceDeletionApi: class {
    runs = runs;
    standaloneShipments = shipments;
    remove = remove;
  },
}));

describe('Страница удаления рейсов и поставок', () => {
  it('сохраняет выбор между страницами, синхронизирует общую поставку и отправляет уникальные ID', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true, addListener: vi.fn(), removeListener: vi.fn() }),
    });
    const shared = {
      id: '501',
      number: '33',
      client: 'ДОХОНГ',
      invoice: 'INV-1',
      declaration: '42666',
      application: '—',
    };
    const separate = { ...shared, id: '502', number: '44' };
    runs.mockImplementation(async (page: number) => ({
      rows: [
        {
          id: String(page),
          number: String(147 + page),
          transport: 'Авто',
          registration: 'ТЕСТ',
          managers: 'Менеджер',
          declarants: 'Декларант',
          shipments: [shared],
        },
      ],
      total: 10,
    }));
    shipments.mockResolvedValue({ rows: [separate], total: 1 });
    remove.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <App>
          <WorkspaceDeletionPage />
        </App>
      </MemoryRouter>,
    );
    const linked = screen.getByRole('region', { name: 'Рейсы с поставками' });
    const standalone = screen.getByRole('region', { name: 'Поставки без рейса' });
    fireEvent.click(await within(linked).findByRole('checkbox', { name: 'Отметить рейс №148' }));
    fireEvent.click(within(linked).getByRole('checkbox', { name: 'Отметить поставку №33' }));
    fireEvent.click(await within(standalone).findByRole('checkbox', { name: 'Отметить поставку №44' }));
    fireEvent.click(within(linked).getByTitle('2'));
    expect(await within(linked).findByRole('checkbox', { name: 'Отметить рейс №149' })).not.toBeChecked();
    expect(within(linked).getByRole('checkbox', { name: 'Отметить поставку №33' })).toBeChecked();
    expect(within(linked).getByText('Выбрано — рейсов: 1, поставок: 1')).toBeVisible();
    expect(within(standalone).getByText('Выбрано — поставок: 1')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить выбранное (3)' }));
    const confirmation = await screen.findByRole('dialog');
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Удалить' }));
    expect(remove).toHaveBeenCalledWith(['1'], ['501', '502']);
  });
});
