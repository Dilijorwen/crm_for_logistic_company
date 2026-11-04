/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { FilterTemplatesController } from '../FilterTemplatesController';
import { emptyFilter } from '../../../../../shared/filterTemplates';
import type { FilterTemplateList } from '../../../../../shared/filterTemplates';

const identity = { tableUid: 'table', referencePath: [] };
const data: FilterTemplateList = { templates: [], schemaSignature: 'first' };

describe('filter templates client state', () => {
  it('validates incomplete conditions before sending a save request', async () => {
    const api = { request: vi.fn().mockResolvedValue(data) };
    const controller = new FilterTemplatesController(api);
    await controller.activate(identity, 'user');
    expect(
      await controller.mutate('create', {
        name: 'Новый',
        columnSettings: { version: 1, columnOrder: [], hiddenColumnUids: [] },
        filter: { logic: '$and', items: [{ path: '', operator: '', value: '' }] },
      }),
    ).toBe(false);
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(controller.state.error).toContain('Заполните');
  });
  it('loads each opening and isolates the table instance and owner', async () => {
    const api = { request: vi.fn().mockResolvedValue(data) };
    const controller = new FilterTemplatesController(api);
    await controller.activate(identity, 'user');
    expect(controller.state.data).toEqual(data);
    expect(controller.matches(identity, 'other-user')).toBe(false);
    expect(controller.matches({ ...identity, referencePath: ['reference'] }, 'user')).toBe(false);
    await controller.activate(identity, 'user');
    expect(api.request).toHaveBeenCalledTimes(2);
  });

  it('ignores late responses after closing or changing users', async () => {
    let resolveRequest: (value: FilterTemplateList) => void = () => {
      throw new Error('Request not started');
    };
    const api = {
      request: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<FilterTemplateList>((resolve) => {
              resolveRequest = resolve;
            }),
        )
        .mockResolvedValue({ ...data, schemaSignature: 'second' }),
    };
    const controller = new FilterTemplatesController(api);
    const previous = controller.activate(identity, 'old-user');
    await controller.activate(identity, 'root');
    resolveRequest(data);
    await previous;
    expect(controller.state.data?.schemaSignature).toBe('second');
    controller.stop();
    expect(controller.state.data).toBeNull();
  });

  it('blocks duplicate saves and retains the available templates on failure', async () => {
    let rejectRequest: (error: Error) => void = () => {
      throw new Error('Request not started');
    };
    const api = {
      request: vi
        .fn()
        .mockResolvedValueOnce(data)
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              rejectRequest = reject;
            }),
        ),
    };
    const controller = new FilterTemplatesController(api);
    await controller.activate(identity, 'user');
    const pending = controller.mutate('create', {
      name: 'Новый',
      columnSettings: { version: 1, columnOrder: [], hiddenColumnUids: [] },
      filter: emptyFilter(),
    });
    expect(await controller.mutate('create', { name: 'Повтор' })).toBe(false);
    rejectRequest(new Error('offline'));
    expect(await pending).toBe(false);
    expect(controller.state.data).toEqual(data);
    expect(controller.state.error).toContain('Не удалось');
    expect(controller.state.isSaving).toBe(false);
    expect(api.request).toHaveBeenCalledTimes(2);
  });

  it('shows a safe server conflict message and allows reloading', async () => {
    const api = {
      request: vi
        .fn()
        .mockResolvedValueOnce(data)
        .mockRejectedValueOnce({ response: { status: 409, data: { errors: [{ message: 'Шаблон уже изменён' }] } } })
        .mockResolvedValue(data),
    };
    const controller = new FilterTemplatesController(api);
    await controller.activate(identity, 'user');
    expect(await controller.mutate('rename', { id: 'template', revision: 1, name: 'Новое' })).toBe(false);
    expect(controller.state.error).toBe('Шаблон уже изменён');
    await controller.reload();
    expect(controller.state.error).toBe('');
  });

  it('clears stale template data when reloading fails', async () => {
    const api = { request: vi.fn().mockResolvedValueOnce(data).mockRejectedValueOnce(new Error('offline')) };
    const controller = new FilterTemplatesController(api);
    await controller.activate(identity, 'user');
    await controller.reload();
    expect(controller.state.data).toBeNull();
    expect(controller.state.error).not.toBe('');
  });
});
