/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import type { ColumnSettings, TablePersonalization } from '../../../../../shared/contracts';
import type { PersonalizationApi } from '../../api/TablePersonalizationApi';
import { PersonalizationController } from '../PersonalizationController';

const identity = { tableUid: 'table', referencePath: [] };
const data: TablePersonalization = { schemaSignature: 'a'.repeat(64), settings: null, columns: [] };
const settings: ColumnSettings = { version: 1, columnOrder: [], hiddenColumnUids: [] };

function fixture() {
  const api: PersonalizationApi = {
    get: vi.fn().mockResolvedValue(data),
    save: vi.fn().mockResolvedValue({ ...data, settings }),
    reset: vi.fn().mockResolvedValue(data),
    width: vi.fn().mockResolvedValue(data),
  };
  return { api, controller: new PersonalizationController(api) };
}

function deferred<T>() {
  let complete!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    complete = resolve;
  });
  return { promise, resolve: complete };
}

describe('personalization request lifecycle', () => {
  function widthFixture() {
    const { api } = fixture();
    const prepare = vi.fn().mockResolvedValue(undefined);
    const controller = new PersonalizationController(api, prepare);
    const layout = { version: 1 as const, columnOrder: ['first', 'second'], hiddenColumnUids: ['second'] };
    const widths: Record<string, number> = {};
    const loaded = { ...data, settings: { ...layout, columnWidths: widths }, resizableColumnUids: ['first', 'second'] };
    vi.mocked(api.get).mockResolvedValue(loaded);
    vi.mocked(api.width).mockImplementation(async (_identity, uid, width) => {
      if (width === null) delete widths[uid];
      else widths[uid] = width;
      return { ...loaded, settings: { ...layout, columnWidths: { ...widths } } };
    });
    return { api, controller, loaded, prepare };
  }

  it('previews without requests and serializes width writes without preparing data again', async () => {
    const { api, controller, prepare, loaded } = widthFixture();
    await controller.activate(identity, 'owner');
    prepare.mockClear();
    controller.previewWidth('first', 220);
    controller.previewWidth('first', 230);
    expect(controller.getWidth('first', 150)).toBe(230);
    expect(api.width).not.toHaveBeenCalled();
    const first = controller.changeWidth('first', 230);
    const second = controller.changeWidth('second', 330);
    expect(controller.state.isSavingWidth).toBe(true);
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(api.width).toHaveBeenCalledTimes(2);
    expect(api.width).toHaveBeenNthCalledWith(1, identity, 'first', 230, loaded.schemaSignature);
    expect(api.width).toHaveBeenNthCalledWith(2, identity, 'second', 330, loaded.schemaSignature);
    expect(controller.state.data?.settings?.columnWidths).toEqual({ first: 230, second: 330 });
    expect(controller.state.data?.settings?.hiddenColumnUids).toEqual(['second']);
    expect(controller.state.isSavingWidth).toBe(false);
    expect(controller.state.previewWidths).toEqual({});
    expect(prepare).not.toHaveBeenCalled();
  });

  it('keeps a later drag preview when an earlier save completes', async () => {
    const { api, controller, loaded } = widthFixture();
    await controller.activate(identity, 'owner');
    const pending = deferred<TablePersonalization>();
    vi.mocked(api.width).mockReturnValueOnce(pending.promise);
    const first = controller.changeWidth('first', 200);
    await vi.waitFor(() => expect(api.width).toHaveBeenCalledOnce());
    controller.previewWidth('first', 270);
    pending.resolve({ ...loaded, settings: { ...loaded.settings, columnWidths: { first: 200 } } });
    await first;
    expect(controller.getWidth('first', 150)).toBe(270);
    controller.cancelWidthPreview('first');
    expect(controller.getWidth('first', 150)).toBe(200);
  });

  it('rolls back failed widths, allows retry and independently restores the shared width', async () => {
    const { api, controller } = widthFixture();
    await controller.activate(identity, 'owner');
    vi.mocked(api.width).mockRejectedValueOnce(new Error('offline'));
    expect(await controller.changeWidth('first', 240)).toBe(false);
    expect(controller.state.widthError).toContain('Не удалось');
    expect(controller.getWidth('first', 150)).toBe(150);
    expect(controller.state.isSavingWidth).toBe(false);
    expect(await controller.changeWidth('first', 240)).toBe(true);
    expect(controller.getWidth('first', 150)).toBe(240);
    expect(await controller.changeWidth('first', null)).toBe(true);
    expect(controller.getWidth('first', 150)).toBe(150);
    expect(await controller.changeWidth('forbidden', 200)).toBe(false);
    expect(api.width).toHaveBeenCalledTimes(3);
  });

  it('reloads after a width conflict without deadlocking the queue', async () => {
    const { api, controller, loaded } = widthFixture();
    await controller.activate(identity, 'owner');
    vi.mocked(api.width).mockRejectedValueOnce({ response: { status: 409 } });
    vi.mocked(api.get).mockResolvedValueOnce({ ...loaded, schemaSignature: 'b'.repeat(64) });
    expect(await controller.changeWidth('first', 250)).toBe(false);
    expect(controller.state.data?.schemaSignature).toBe('b'.repeat(64));
    expect(controller.state.isSavingWidth).toBe(false);
    expect(await controller.changeWidth('first', 260)).toBe(true);
    expect(api.width).toHaveBeenLastCalledWith(identity, 'first', 260, 'b'.repeat(64));
  });

  it('discards queued widths and layout changes from a previous owner', async () => {
    const { api, controller, loaded } = widthFixture();
    await controller.activate(identity, 'old-owner');
    const pending = deferred<TablePersonalization>();
    vi.mocked(api.width).mockReturnValueOnce(pending.promise);
    const first = controller.changeWidth('first', 220);
    const queued = controller.changeWidth('second', 330);
    const save = controller.save(settings);
    await vi.waitFor(() => expect(api.width).toHaveBeenCalledOnce());
    await controller.activate(identity, 'new-owner');
    pending.resolve({ ...loaded, settings: { ...loaded.settings, columnWidths: { first: 220 } } });
    expect(await first).toBe(false);
    expect(await queued).toBe(false);
    expect(await save).toBe(false);
    expect(api.width).toHaveBeenCalledOnce();
    expect(api.save).not.toHaveBeenCalled();
    expect(controller.getWidth('first', 150)).toBe(150);
  });
  it('loads once per owner, saves and resets successfully', async () => {
    const { controller, api } = fixture();
    await controller.activate(identity, 'user-one:role-one');
    await controller.activate(identity, 'user-one:role-one');
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(await controller.save(settings)).toBe(true);
    expect(controller.state.data?.settings).toEqual(settings);
    expect(await controller.reset()).toBe(true);
    expect(controller.state.data?.settings).toBeNull();
  });

  it('keeps shared defaults and supports retry after a load error', async () => {
    const { controller, api } = fixture();
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'));
    await controller.activate(identity, 'owner');
    expect(controller.state.data).toBeNull();
    expect(controller.state.error).toContain('загрузить');
    expect(await controller.save(settings)).toBe(false);
    await controller.reload();
    expect(controller.state.error).toBe('');
    expect(controller.state.data).toEqual(data);
  });

  it('blocks duplicate saves and does not fake success on a storage error', async () => {
    const { controller, api } = fixture();
    await controller.activate(identity, 'owner');
    const pending = deferred<TablePersonalization>();
    vi.mocked(api.save).mockReturnValueOnce(pending.promise);
    const first = controller.save(settings);
    expect(await controller.save(settings)).toBe(false);
    expect(api.save).toHaveBeenCalledTimes(1);
    pending.resolve({ ...data, settings });
    expect(await first).toBe(true);
    vi.mocked(api.save).mockRejectedValueOnce(new Error('unavailable'));
    expect(await controller.save(settings)).toBe(false);
    expect(controller.state.error).toContain('сохранить');
    expect(controller.state.isSaving).toBe(false);
  });

  it('refreshes descriptors after conflict without claiming that the draft was saved', async () => {
    const { controller, api } = fixture();
    await controller.activate(identity, 'owner');
    vi.mocked(api.save).mockRejectedValueOnce({ response: { status: 409 } });
    vi.mocked(api.get).mockResolvedValueOnce({ ...data, schemaSignature: 'b'.repeat(64) });
    expect(await controller.save(settings)).toBe(false);
    expect(controller.state.data?.schemaSignature).toBe('b'.repeat(64));
    expect(controller.state.error).toContain('изменились');
  });

  it('ignores pending responses from a previous user or role', async () => {
    const { controller, api } = fixture();
    const pending = deferred<TablePersonalization>();
    vi.mocked(api.get).mockReturnValueOnce(pending.promise);
    const first = controller.activate(identity, 'old-owner');
    await controller.activate(identity, 'new-owner');
    pending.resolve({ ...data, settings });
    await first;
    expect(controller.state.data?.settings).toBeNull();
    expect(controller.matches(identity, 'new-owner')).toBe(true);
  });

  it('ignores stale save completion after unmount', async () => {
    const { controller, api } = fixture();
    await controller.activate(identity, 'owner');
    const pending = deferred<TablePersonalization>();
    vi.mocked(api.save).mockReturnValueOnce(pending.promise);
    const save = controller.save(settings);
    controller.stop();
    pending.resolve({ ...data, settings });
    expect(await save).toBe(false);
    expect(controller.state.data).toBeNull();
  });

  it('publishes descriptors only after runtime preparation and ignores a stale preparation', async () => {
    const { api } = fixture();
    const pending = deferred<void>();
    const prepare = vi
      .fn()
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValue(undefined);
    const controller = new PersonalizationController(api, prepare);
    const first = controller.activate(identity, 'old-owner');
    await vi.waitFor(() => expect(prepare).toHaveBeenCalledOnce());
    expect(controller.state.data).toBeNull();
    expect(controller.state.isLoading).toBe(true);
    const isCurrent = prepare.mock.calls[0][1] as () => boolean;
    await controller.activate(identity, 'new-owner');
    expect(isCurrent()).toBe(false);
    pending.resolve();
    await first;
    expect(controller.state.data).toEqual(data);
  });

  it('reports preparation errors and allows retry without publishing incomplete columns', async () => {
    const { api } = fixture();
    const prepare = vi.fn().mockRejectedValueOnce(new Error('resource unavailable')).mockResolvedValue(undefined);
    const controller = new PersonalizationController(api, prepare);
    await controller.activate(identity, 'owner');
    expect(controller.state.data).toBeNull();
    expect(controller.state.error).toContain('загрузить');
    await controller.reload();
    expect(controller.state.data).toEqual(data);
    expect(controller.state.error).toBe('');
  });
});
