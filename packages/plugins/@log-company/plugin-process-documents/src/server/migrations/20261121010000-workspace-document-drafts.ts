/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Transaction } from '@nocobase/database';
import { Migration } from '@nocobase/server';

type Options = { transaction: Transaction; includeAsyncNode: true };
type DocumentBlock = { use: string; props?: Record<string, unknown> };
interface Models {
  findModelById(uid: string, options: Options): Promise<DocumentBlock | null>;
  upsertModel(model: DocumentBlock & { uid: string }, options: Options): Promise<unknown>;
}

const runBlocks = ['lcwscreaterungriddocuments', 'lcwsrunformgriddocuments'];
const formBlocks = ['lcwscreatedocuments', 'lcwspagedocs'];
const standaloneBlock = 'lcwsdocuments';
const documentModel = 'ProcessDocumentsBlockModel';

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    if (!this.db.getCollection('flowModels')) return;
    const models = this.db.getRepository('flowModels') as unknown as Models;
    await this.db.sequelize.transaction(async (transaction) => {
      const options: Options = { transaction, includeAsyncNode: true };
      for (const uid of [...runBlocks, ...formBlocks, standaloneBlock]) {
        const block = await models.findModelById(uid, options);
        if (!block) continue;
        // The legacy run wrapper opens a different engine and cannot bind to form submit.
        const legacyRun = runBlocks.includes(uid) && block.use === 'LogisticsWorkspaceRunDocumentsModel';
        if (!legacyRun && (block.use !== documentModel || block.props?.folderMode)) continue;
        await models.upsertModel(
          {
            uid,
            use: documentModel,
            props: { ...block.props, folderMode: uid === standaloneBlock ? 'view' : 'upload' },
          },
          options,
        );
      }
    });
  }
}
