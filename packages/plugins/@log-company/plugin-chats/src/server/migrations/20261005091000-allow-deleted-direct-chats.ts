/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';

export default class extends Migration {
  on = 'afterSync';

  async up(): Promise<void> {
    await this.db.sequelize.transaction(async (transaction) => {
      await this.db.sequelize.query(
        `
        alter table chats drop constraint if exists chats_shape_check;
        alter table chats add constraint chats_shape_check check (
          (type = 'direct' and (direct_key is not null or deleted_at is not null) and title is null)
          or (type = 'group' and direct_key is null and nullif(btrim(title), '') is not null)
        );
      `,
        { transaction },
      );
    });
  }
}
