/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Context, Next } from '@nocobase/actions';
import { Database } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublishFormDocuments } from '../../../application/PublishFormDocuments';
import { TemporaryDocumentDrafts } from '../../../infrastructure/storage/TemporaryDocumentDrafts';
import { FormDocumentDraftsController } from '../FormDocumentDraftsController';

describe('Сохранение записи с временными документами', () => {
  let db: Database;
  let root: string;
  let drafts: TemporaryDocumentDrafts;
  let save: (context: Context, next: Next) => Promise<void>;
  const upload = { execute: vi.fn() };

  beforeEach(async () => {
    upload.execute.mockReset();
    db = new Database({ dialect: 'sqlite', storage: ':memory:', logging: false });
    db.collection({ name: 'shipments', fields: [{ name: 'title', type: 'string' }] });
    db.collection({ name: 'published_documents', fields: [{ name: 'title', type: 'string' }] });
    await db.sync();
    root = await mkdtemp(path.join(tmpdir(), 'form-documents-test-'));
    drafts = new TemporaryDocumentDrafts(root, () => undefined);
    const plugin = {
      db,
      app: {
        acl: { allow: vi.fn() },
        resourceManager: {
          define: vi.fn(),
          use: (handler: typeof save) => {
            save = handler;
          },
        },
      },
    } as unknown as Plugin;
    new FormDocumentDraftsController(plugin, drafts, upload as unknown as PublishFormDocuments).register();
  });

  afterEach(async () => {
    await db.close();
    await rm(root, { recursive: true, force: true });
  });

  async function stage(recordId: string | null = null) {
    return drafts.stage('1', { resource: 'shipments', recordId }, async (directory) => {
      const file = path.join(directory, 'file');
      await writeFile(file, 'hello');
      return [{ path: file, size: 5, originalName: 'Контракты/Договор.txt', mimeType: 'text/plain' }];
    });
  }
  function context(token: string, id?: string): Context {
    return {
      state: { currentUser: { id: 1 }, currentRole: 'root' },
      action: {
        actionName: id ? 'update' : 'create',
        resourceName: 'shipments',
        params: { values: { title: 'Карточка' }, ...(id && { filterByTk: id }) },
      },
      get: (header: string) => (header === 'X-Log-Company-Form-Documents' ? token : ''),
      status: 200,
      throw(status: number, message: string) {
        throw Object.assign(new Error(message), { status });
      },
    } as unknown as Context;
  }

  it('публикует файлы при успешном создании и удаляет временную копию после commit', async () => {
    const batch = await stage();
    expect(upload.execute).not.toHaveBeenCalled();
    upload.execute.mockImplementation(async (input, { transaction }) => {
      await db.getRepository('published_documents').create({
        values: { title: input.files[0].originalName },
        transaction,
      });
    });
    const request = context(batch.token);
    await save(request, async () => {
      await db.getRepository('shipments').create({ values: { title: 'Карточка' }, context: request });
    });
    const shipment = await db.getRepository('shipments').findOne();
    expect(shipment).toBeTruthy();
    expect(upload.execute).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'shipments', recordId: String(shipment.get('id')) }),
      expect.anything(),
    );
    expect(await db.getRepository('published_documents').count()).toBe(1);
    expect(await readdir(root)).toEqual([]);
  });

  it('откатывает запись и файлы при сбое после публикации и сохраняет возможность повторить', async () => {
    const batch = await stage();
    const removeObject = vi.fn();
    upload.execute.mockImplementation(async (input, { transaction, onRollback }) => {
      await db
        .getRepository('published_documents')
        .create({ values: { title: input.files[0].originalName }, transaction });
      onRollback(removeObject);
    });
    const request = context(batch.token);
    await expect(
      save(request, async () => {
        db.once('shipments.afterSaveWithAssociations', () => {
          throw new Error('save failed');
        });
        await db.getRepository('shipments').create({ values: { title: 'Карточка' }, context: request });
      }),
    ).rejects.toThrow('save failed');
    expect(await db.getRepository('shipments').count()).toBe(0);
    expect(await db.getRepository('published_documents').count()).toBe(0);
    expect(removeObject).toHaveBeenCalledOnce();
    expect(await readdir(root)).toHaveLength(1);
    const retry = context(batch.token);
    await save(retry, async () => {
      await db.getRepository('shipments').create({ values: { title: 'Карточка' }, context: retry });
    });
    expect(await readdir(root)).toEqual([]);
  });

  it('блокирует преждевременное сохранение и не позволяет присоединить черновик к другой записи', async () => {
    const next = vi.fn();
    await expect(save(context('pending'), next)).rejects.toMatchObject({ status: 409 });
    const batch = await stage('10');
    await expect(save(context(batch.token, '11'), next)).rejects.toMatchObject({ status: 403 });
    expect(next).not.toHaveBeenCalled();
  });

  it('публикует черновик только при обновлении выбранной записи', async () => {
    const card = await db.getRepository('shipments').create({ values: { title: 'Исходная карточка' } });
    const id = String(card.get('id'));
    const batch = await stage(id);
    const request = context(batch.token, id);
    upload.execute.mockResolvedValue({});
    await save(request, async () => {
      await db.getRepository('shipments').update({ filterByTk: id, values: { title: 'Обновлено' }, context: request });
    });
    expect(upload.execute).toHaveBeenCalledOnce();
    expect((await db.getRepository('shipments').findOne({ filterByTk: id })).get('title')).toBe('Обновлено');
    expect(await readdir(root)).toEqual([]);
  });
});
