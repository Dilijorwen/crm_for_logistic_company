/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { App } from 'antd';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterTemplatesToolbar } from '../FilterTemplatesToolbar';
import { TableTemplatesButton } from '../TableTemplatesButton';
import { FilterTemplatesController } from '../../model/FilterTemplatesController';
import type { TableTemplateHost } from '../../model/TableTemplateHost';
import type {
  FilterTemplate,
  FilterTemplateInput,
  FilterTemplateList,
  FilterTemplateOperation,
  TableTemplateSnapshot,
} from '../../../../../shared/filterTemplates';
import { emptyFilter } from '../../../../../shared/filterTemplates';

const columns = { version: 1 as const, columnOrder: ['first'], hiddenColumnUids: [], columnWidths: { first: 210 } };
const template: FilterTemplate = {
  id: 'template',
  name: 'Мой шаблон',
  filter: emptyFilter(),
  columnSettings: columns,
  revision: 1,
};

function fixture(data: FilterTemplateList = { templates: [], schemaSignature: 'signature' }) {
  const request = vi.fn(
    async (operation: FilterTemplateOperation, input: FilterTemplateInput): Promise<FilterTemplateList> => {
      if (operation === 'create')
        return {
          ...data,
          templates: [
            {
              ...template,
              name: input.name || '',
              filter: input.filter || emptyFilter(),
              columnSettings: input.columnSettings || columns,
            },
          ],
        };
      return data;
    },
  );
  const capture = vi
    .fn<[], Promise<TableTemplateSnapshot>>()
    .mockResolvedValue({ filter: emptyFilter(), columnSettings: columns });
  const apply = vi.fn().mockResolvedValue(true);
  const model: TableTemplateHost = {
    templates: new FilterTemplatesController({ request }),
    getPersonalizationIdentity: () => ({ tableUid: 'table', referencePath: [] }),
    getPersonalizationOwner: () => 'user',
    captureTemplateSnapshot: capture,
    applyTableTemplate: apply,
    isTemplateOperationBlocked: () => false,
  };
  const user = userEvent.setup();
  render(
    <App>
      <FilterTemplatesToolbar model={model} isOpen />
    </App>,
  );
  return { model, request, user, capture, apply };
}

describe('personal table template controls', () => {
  it('resets columns even when no template is already selected', async () => {
    const { user, apply } = fixture();
    await screen.findByText('Сохранённых шаблонов пока нет');
    await user.click(screen.getByRole('combobox', { name: 'Шаблон таблицы' }));
    await user.click(await screen.findByText('Без шаблона', { selector: '.ant-select-item-option-content' }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith(undefined));
  });
  it('saves filter and complete columns without any visibility options', async () => {
    const { user, request } = fixture();
    await screen.findByText('Сохранённых шаблонов пока нет');
    await user.click(screen.getByRole('button', { name: 'Сохранить как новый' }));
    await user.type(screen.getByLabelText('Название шаблона'), 'Новый');
    expect(screen.queryByText('Доступность')).toBeNull();
    expect(screen.queryByText('Общие шаблоны')).toBeNull();
    await user.click(screen.getByRole('button', { name: /^Сохранить$/ }));
    await screen.findByRole('button', { name: 'Обновить шаблон' });
    expect(request).toHaveBeenCalledWith('create', {
      identity: { tableUid: 'table', referencePath: [] },
      name: 'Новый',
      filter: emptyFilter(),
      columnSettings: columns,
      schemaSignature: 'signature',
    });
  });

  it('updates conditions and columns only after an explicit action', async () => {
    const { user, model, request, capture } = fixture({ templates: [template], schemaSignature: 'signature' });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Шаблон таблицы' })).not.toBeDisabled());
    act(() => {
      model.templates.state.selectedTemplateId = template.id;
    });
    const snapshot: TableTemplateSnapshot = {
      filter: { logic: '$or', items: [{ path: 'first', operator: '$eq', value: 42 }] },
      columnSettings: { ...columns, columnWidths: { first: 330 } },
    };
    capture.mockResolvedValue(snapshot);
    expect(request.mock.calls.filter(([operation]) => operation === 'update')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Обновить шаблон' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        'update',
        expect.objectContaining({ id: template.id, revision: 1, ...snapshot }),
      ),
    );
  });

  it('keeps the form and name after a save failure', async () => {
    const { user, request } = fixture();
    await screen.findByText('Сохранённых шаблонов пока нет');
    await user.click(screen.getByRole('button', { name: 'Сохранить как новый' }));
    await user.type(screen.getByLabelText('Название шаблона'), 'Не терять');
    request.mockRejectedValueOnce(new Error('offline'));
    await user.click(screen.getByRole('button', { name: /^Сохранить$/ }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Название шаблона')).toHaveValue('Не терять');
    expect(screen.getByRole('button', { name: /^Сохранить$/ })).not.toBeDisabled();
  });

  it('renders a separate labeled button', () => {
    const model = {
      templates: new FilterTemplatesController({ request: vi.fn() }),
      isTemplateOperationBlocked: () => false,
    } as unknown as TableTemplateHost;
    render(
      <App>
        <TableTemplatesButton model={model} />
      </App>,
    );
    expect(screen.getByRole('button', { name: 'Шаблоны' })).toHaveTextContent('Шаблоны');
  });
});
