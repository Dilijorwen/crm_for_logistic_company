/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Database, type MultipleRelationRepository } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import type PluginFileManager from '@nocobase/plugin-file-manager/server';
import type PluginFileStorage from '@log-company/plugin-file-storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NocoBaseFormDocumentOwners } from '../NocoBaseFormDocumentOwners';
import type { NocoBaseProcessDocumentAccess } from '../NocoBaseProcessDocumentAccess';

describe('Штатные связи файлов в NocoBase', () => {
  let db: Database;
  let owners: NocoBaseFormDocumentOwners;
  const store = vi.fn();
  const enqueue = vi.fn();
  const assertPermitUpload = vi.fn();
  const actor = { isRoot: false, userId: '1', authorizationContext: {} };

  beforeEach(async () => {
    vi.resetAllMocks();
    db = new Database({ dialect: 'sqlite', storage: ':memory:', logging: false });
    db.collection({ name: 'our_companies', fields: [] });
    db.collection({
      name: 'contracts',
      fields: [{ name: 'importers', type: 'belongsToMany', target: 'our_companies' }],
    });
    db.collection({
      name: 'attachments',
      fields: [
        ...['filename', 'path', 'title', 'extname', 'mimetype', 'storageId', 'size', 'createdById'].map((name) => ({
          name,
          type: 'string',
        })),
        { name: 'meta', type: 'json' },
      ],
    });
    db.collection({
      name: 'permit_documents',
      fields: [{ name: 'documents', type: 'belongsToMany', target: 'attachments' }],
    });
    await db.sync();
    owners = new NocoBaseFormDocumentOwners(
      { db } as Plugin,
      {
        storagesCache: new Map([
          [8, { id: 8, name: 'log-company-files', type: 'log-company-private-minio', path: '/private/' }],
        ]),
      } as unknown as PluginFileManager,
      { storage: { area: () => ({ store }) }, deletionQueue: { enqueue } } as unknown as PluginFileStorage,
      { assertPermitUpload } as unknown as NocoBaseProcessDocumentAccess,
    );
  });

  afterEach(async () => {
    await db.close();
  });

  it('видит импортёров, сохранённых на той же форме контракта', async () => {
    await db.getRepository('our_companies').create({ values: { id: 10 } });
    await db.getRepository('our_companies').create({ values: { id: 11 } });
    await db.sequelize.transaction(async (transaction) => {
      await db.getRepository('contracts').create({ values: { id: 40, importers: [10] }, transaction });
      expect(await owners.contractImporterIds('40', transaction)).toEqual(['10']);
      await db.getRepository('contracts').update({ filterByTk: 40, values: { importers: [11] }, transaction });
      expect(await owners.contractImporterIds('40', transaction)).toEqual(['11']);
    });
  });

  it('сохраняет метаданные MinIO и связывает файлы с разрешительным документом', async () => {
    await db.sequelize.transaction(async (transaction) => {
      await db.getRepository('permit_documents').create({ values: { id: 50 }, transaction });
      const onRollback = vi.fn();
      await owners.publishPermit(
        {
          resource: 'permit_documents',
          recordId: '50',
          actor,
          files: [
            {
              path: '/tmp/permit-pdf',
              originalName: 'Папка/2026/Сертификат.pdf',
              size: 100,
              mimeType: 'application/pdf',
            },
          ],
        },
        { transaction, onRollback },
      );
      expect(assertPermitUpload).toHaveBeenCalledWith('50', actor, transaction);
      const related = await db
        .getRepository<MultipleRelationRepository>('permit_documents.documents', 50)
        .find({ transaction });
      expect(related).toHaveLength(1);
      expect(related[0].toJSON()).toMatchObject({
        title: 'Сертификат',
        extname: '.pdf',
        path: 'private',
        storageId: '8',
        mimetype: 'application/pdf',
        meta: { logCompanyDocumentFolders: ['Папка', '2026'] },
      });
      const key = `private/${related[0].get('filename')}`;
      expect(store).toHaveBeenCalledWith({
        key,
        filePath: '/tmp/permit-pdf',
        size: 100,
        contentType: 'application/pdf',
      });
      const cleanup = onRollback.mock.calls[0][0];
      await cleanup();
      expect(enqueue).toHaveBeenCalledWith('attachments', [key], { currentOnly: true });
    });
  });
});
