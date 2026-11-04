/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { ensureTransportTypeForms } from '../infrastructure/metadata/EnsureTransportTypeForms';

export default class extends Migration {
  on = 'afterLoad';
  async up(): Promise<void> {
    await this.db.sequelize.transaction(async (transaction) => {
      await ensureTransportTypeForms(this.db, transaction);
      const models = this.db.getRepository('flowModels') as unknown as {
        findOne(options: { filter: { uid: string }; transaction: typeof transaction }): Promise<unknown>;
        remove(uid: string, options: { transaction: typeof transaction }): Promise<unknown>;
      };
      if (await models.findOne({ filter: { uid: 'lcwsrefresh' }, transaction }))
        await models.remove('lcwsrefresh', { transaction });
    });
  }
}
