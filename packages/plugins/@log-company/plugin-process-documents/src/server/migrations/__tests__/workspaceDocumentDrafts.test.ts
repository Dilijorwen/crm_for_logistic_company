/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import WorkspaceDocumentDrafts from '../20261121010000-workspace-document-drafts';

describe('Загрузка документов в существующем рабочем списке', () => {
  it('подключает форму рейса и поставки, не трогая пользовательские настройки других блоков', async () => {
    const models = new Map([
      ['lcwscreaterungriddocuments', { use: 'LogisticsWorkspaceRunDocumentsModel', props: {} }],
      ['lcwsrunformgriddocuments', { use: 'LogisticsWorkspaceRunDocumentsModel', props: { preserved: true } }],
      ['lcwscreatedocuments', { use: 'ProcessDocumentsBlockModel', props: {} }],
      ['lcwspagedocs', { use: 'ProcessDocumentsBlockModel', props: { workspaceSectionTitle: 'Документы' } }],
      ['lcwsdocuments', { use: 'ProcessDocumentsBlockModel', props: {} }],
      ['custom', { use: 'ProcessDocumentsBlockModel', props: { folderMode: 'view' } }],
    ]);
    const db = {
      sequelize: { transaction: (run: (transaction: object) => Promise<void>) => run({}) },
      getCollection: () => ({}),
      getRepository: () => ({
        findModelById: async (uid: string) => models.get(uid),
        upsertModel: async ({ uid, ...block }: { uid: string; use: string; props: object }) => models.set(uid, block),
      }),
    };
    const migration = new WorkspaceDocumentDrafts({ db } as unknown as ConstructorParameters<
      typeof WorkspaceDocumentDrafts
    >[0]);
    await migration.up();
    await migration.up();
    expect(models.get('lcwscreaterungriddocuments')).toMatchObject({
      use: 'ProcessDocumentsBlockModel',
      props: { folderMode: 'upload' },
    });
    expect(models.get('lcwsrunformgriddocuments')).toMatchObject({
      use: 'ProcessDocumentsBlockModel',
      props: { folderMode: 'upload', preserved: true },
    });
    expect(models.get('lcwscreatedocuments')?.props).toMatchObject({ folderMode: 'upload' });
    expect(models.get('lcwspagedocs')?.props).toEqual({ workspaceSectionTitle: 'Документы', folderMode: 'upload' });
    expect(models.get('lcwsdocuments')?.props).toEqual({ folderMode: 'view' });
    expect(models.get('custom')?.props).toEqual({ folderMode: 'view' });
  });
});
