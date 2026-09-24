/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';

const CONSTRAINT_NAME = 'permit_documents_success_payload_check';

export default class AllowOpenEndedFsaDocuments extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    if (this.db.sequelize.getDialect() !== 'postgres') {
      return;
    }
    await this.db.sequelize.query(
      `alter table permit_documents drop constraint if exists ${CONSTRAINT_NAME};
       alter table permit_documents add constraint ${CONSTRAINT_NAME} check (
         sync_status <> 'SUCCESS' or (
           status is not null
           and valid_from is not null
           and nullif(btrim(product_information), '') is not null
           and (document_type <> 'state_registration_certificate' or valid_until is null)
         )
       );`,
    );
  }

  async down(): Promise<void> {
    // Open-ended FSA documents are valid registry records and must remain representable.
  }
}
