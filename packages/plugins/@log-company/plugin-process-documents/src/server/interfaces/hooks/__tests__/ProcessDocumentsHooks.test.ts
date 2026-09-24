/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { describe, expect, it, vi } from 'vitest';
import type { AttachDraftDocumentsToProcess } from '../../../application/AttachDraftDocumentsToProcess';
import type { DeleteProcessDocumentsForProcess } from '../../../application/DeleteProcessDocumentsForProcess';
import type { ValidateDocumentFolderPlacement } from '../../../application/ValidateDocumentFolderPlacement';
import type { ValidateProcessDocumentPlacement } from '../../../application/ValidateProcessDocumentPlacement';
import type { ApplicationLogger, DocumentStorage } from '../../../application/ports/DocumentStorage';
import type {
  ProcessDocumentsRepository,
  TransactionContext,
} from '../../../application/ports/ProcessDocumentsRepository';
import { ProcessDocumentsHooks } from '../ProcessDocumentsHooks';

type HookHandler = (
  model: { isNewRecord?: boolean; get(key: string): unknown },
  options: { transaction?: TransactionContext },
) => Promise<void>;

function hookFixture() {
  const handlers = new Map<string, HookHandler>();
  const plugin = {
    db: {
      on: vi.fn((eventName: string, handler: HookHandler) => {
        handlers.set(eventName, handler);
      }),
    },
  } as unknown as Plugin;
  const deleteProcessDocumentsExecute = vi.fn().mockResolvedValue(undefined);
  const hooks = new ProcessDocumentsHooks(
    plugin,
    {} as ProcessDocumentsRepository,
    {} as DocumentStorage,
    {} as AttachDraftDocumentsToProcess,
    { execute: deleteProcessDocumentsExecute } as unknown as DeleteProcessDocumentsForProcess,
    {} as ValidateDocumentFolderPlacement,
    {} as ValidateProcessDocumentPlacement,
    {} as ApplicationLogger,
  );
  hooks.register();
  return { handlers, deleteProcessDocumentsExecute };
}

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
