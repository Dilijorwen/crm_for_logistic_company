/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';

const SHIPMENTS_COLLECTION = 'shipments';
const COMMENTS_COLLECTION = 'shipment_comments';

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.updateField(SHIPMENTS_COLLECTION, 'comments');
    await this.updateField(COMMENTS_COLLECTION, 'shipment');
  }

  async down(): Promise<void> {
    // Cascade deletion remains required to prevent orphaned shipment comments.
  }

  private async updateField(collectionName: string, name: string): Promise<void> {
    await this.db.sequelize.query(
      `
        update fields
        set options = jsonb_set(coalesce(options::jsonb, '{}'::jsonb), '{onDelete}', '"CASCADE"'::jsonb, true)::json
        where "collectionName" = :collectionName and name = :name
      `,
      { replacements: { collectionName, name } },
    );
  }
}
