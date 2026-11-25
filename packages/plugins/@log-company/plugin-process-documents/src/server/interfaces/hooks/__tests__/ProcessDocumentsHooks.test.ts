/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { Database } from '@nocobase/database';
import { describe, expect, it, vi } from 'vitest';
import type { AttachDraftDocumentsToProcess } from '../../../application/AttachDraftDocumentsToProcess';
import type { DeleteProcessDocumentsForProcess } from '../../../application/DeleteProcessDocumentsForProcess';
import type { ValidateDocumentFolderPlacement } from '../../../application/ValidateDocumentFolderPlacement';
import type { ValidateProcessDocumentPlacement } from '../../../application/ValidateProcessDocumentPlacement';
import type { DocumentStorage } from '../../../application/ports/DocumentStorage';
import type {
  ProcessDocumentsRepository,
  TransactionContext,
} from '../../../application/ports/ProcessDocumentsRepository';
import { ProcessDocumentsHooks } from '../ProcessDocumentsHooks';
import { DocumentFolderService } from '../../../application/DocumentFolderService';
import type { DocumentScopeService } from '../../../application/DocumentScopeService';

type HookHandler = (
  model: { isNewRecord?: boolean; get(key: string): unknown },
  options: { transaction?: TransactionContext; context?: { action: { params: { values: { draftToken: string } } } } },
) => Promise<void>;

function hookFixture(existing: string[] = [], db?: Database) {
  const handlers = new Map<string, HookHandler>();
  const plugin = {
    db: db ?? {
      on: vi.fn((eventName: string, handler: HookHandler) => {
        handlers.set(eventName, handler);
      }),
    },
  } as unknown as Plugin;
  const deleteProcessDocumentsExecute = vi.fn().mockResolvedValue(undefined);
  const attachDraft = vi.fn().mockResolvedValue(undefined);
  const titles = [...existing];
  const createFolder = vi.fn(async (folder: { title: string }, _transaction: TransactionContext) => {
    titles.push(folder.title);
    return folder;
  });
  const repository = {
    listFolderTitles: vi.fn(async () => titles),
    createFolder,
  } as unknown as ProcessDocumentsRepository;
  const folders = new DocumentFolderService(
    repository,
    { requireFolder: vi.fn().mockResolvedValue(null) } as unknown as DocumentScopeService,
    { generate: vi.fn().mockReturnValue('folder-id') },
  );
  const hooks = new ProcessDocumentsHooks(
    plugin,
    repository,
    {} as DocumentStorage,
    { execute: attachDraft } as unknown as AttachDraftDocumentsToProcess,
    { execute: deleteProcessDocumentsExecute } as unknown as DeleteProcessDocumentsForProcess,
    {} as ValidateDocumentFolderPlacement,
    {} as ValidateProcessDocumentPlacement,
    folders,
  );
  hooks.register();
  return { handlers, deleteProcessDocumentsExecute, createFolder, titles };
}

describe('ProcessDocumentsHooks shipment creation', () => {
  it.each(['direct', 'inside a run'])('creates folders when a new shipment is saved %s', async (method) => {
    const db = new Database({ dialect: 'sqlite', storage: ':memory:', logging: false });
    try {
      db.collection({ name: 'shipments', fields: [{ type: 'string', name: 'title' }] });
      db.collection({
        name: 'transport_runs',
        fields: [{ type: 'belongsToMany', name: 'shipments', target: 'shipments', through: 'transport_run_shipments' }],
      });
      await db.sync();
      const { titles, createFolder } = hookFixture([], db);
      const shipments = db.getRepository('shipments');
      if (method === 'direct') {
        await shipments.create({ values: { title: 'Поставка' } });
      } else {
        const runs = db.getRepository('transport_runs');
        const run = await runs.create({ values: {} });
        await runs.update({
          filterByTk: run.get('id'),
          updateAssociationValues: ['shipments'],
          values: { shipments: [{ title: 'Поставка из рейса' }] },
        });
      }

      const shipment = await shipments.findOne();
      expect(titles.sort()).toEqual(['Бухгалтерия', 'Декларанты', 'Карго', 'Менеджеры', 'Юристы']);
      expect(createFolder).toHaveBeenCalledWith(
        expect.objectContaining({ scope: { mode: 'shipment', shipmentId: String(shipment.get('id')) } }),
        expect.anything(),
      );
    } finally {
      await db.close();
    }
  });

  it.each([[], ['Карго']].map((existing) => ({ existing })))(
    'creates department folders in the shipment transaction without duplicating $existing',
    async ({ existing }) => {
      const { handlers, createFolder, titles } = hookFixture(existing);
      const transaction: TransactionContext = {};
      const handler = handlers.get('shipments.afterCreateWithAssociations');
      expect(handler).toBeDefined();
      await handler?.(
        { get: (name) => (name === 'id' ? '38' : null) },
        { transaction, context: { action: { params: { values: { draftToken: 'existing-draft-token' } } } } },
      );

      expect(titles.sort()).toEqual(['Бухгалтерия', 'Декларанты', 'Карго', 'Менеджеры', 'Юристы']);
      expect(createFolder).toHaveBeenCalledTimes(5 - existing.length);
      for (const [folder, tx] of createFolder.mock.calls) {
        expect(folder).toMatchObject({ scope: { mode: 'shipment', shipmentId: '38' }, parentFolderId: null });
        expect(tx).toBe(transaction);
      }
    },
  );
});

describe('ProcessDocumentsHooks shipment deletion', () => {
  it('cleans documents after a shipment is destroyed', async () => {
    const { handlers, deleteProcessDocumentsExecute } = hookFixture();
    const handler = handlers.get('shipments.afterDestroy');
    const transaction: TransactionContext = {};
    if (!handler) {
      throw new Error('shipments.afterDestroy hook was not registered');
    }

    await handler({ get: () => 'shipment-1' }, { transaction });

    expect(deleteProcessDocumentsExecute).toHaveBeenCalledWith({ shipmentId: 'shipment-1', transaction });
  });

  it('ignores a destroyed shipment without an identifier', async () => {
    const { handlers, deleteProcessDocumentsExecute } = hookFixture();
    const handler = handlers.get('shipments.afterDestroy');
    if (!handler) {
      throw new Error('shipments.afterDestroy hook was not registered');
    }

    await handler({ get: () => null }, {});

    expect(deleteProcessDocumentsExecute).not.toHaveBeenCalled();
  });
});
