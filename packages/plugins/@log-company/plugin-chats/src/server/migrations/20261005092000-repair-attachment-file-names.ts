/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { QueryTypes } from 'sequelize';
import { decodeUploadedFileName } from '../infrastructure/files/UploadedFileName';

interface AttachmentNameRow {
  id: string;
  file_name: string;
}

const BATCH_SIZE = 500;

export default class extends Migration {
  on = 'afterSync';

  async up(): Promise<void> {
    await this.db.sequelize.transaction(async (transaction) => {
      let cursor = '0';
      let hasMore = true;
      while (hasMore) {
        const rows = await this.db.sequelize.query<AttachmentNameRow>(
          `select id, file_name from chat_message_attachments
           where id > :cursor order by id limit :limit`,
          { replacements: { cursor, limit: BATCH_SIZE }, type: QueryTypes.SELECT, transaction },
        );
        for (const row of rows) {
          const fileName = decodeUploadedFileName(row.file_name);
          if (fileName !== row.file_name) {
            await this.db.sequelize.query(
              `update chat_message_attachments set file_name = :fileName
               where id = :id and file_name = :originalName`,
              { replacements: { id: row.id, fileName, originalName: row.file_name }, transaction },
            );
          }
        }
        hasMore = rows.length === BATCH_SIZE;
        if (hasMore) cursor = String(rows[rows.length - 1].id);
      }
    });
  }
}
