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
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.db.sequelize.query(`
      update shipments s
      set display_name = concat(
        coalesce(nullif(btrim(s.shipment_number::text), ''), '—'), '/',
        coalesce(
          nullif(btrim((select c.name from chinese_clients c where c.id = s.chinese_client_id)), ''),
          '—'
        ), '/',
        coalesce(nullif(btrim(s.invoice_number), ''), '—'), '/',
        coalesce(nullif(btrim(s.application_number), ''), '—'), '/',
        coalesce(nullif(btrim(s.declaration_number), ''), '—')
      )
    `);
  }

  async down(): Promise<void> {
    // Existing calculated titles are intentionally preserved.
  }
}
