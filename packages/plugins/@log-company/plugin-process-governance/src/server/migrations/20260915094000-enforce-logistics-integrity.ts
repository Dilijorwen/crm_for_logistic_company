/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';

interface ForeignKeyDefinition {
  name: string;
  table: string;
  field: string;
  referencedTable: string;
  onDelete: 'CASCADE' | 'RESTRICT' | 'SET NULL';
}

const FOREIGN_KEYS: ForeignKeyDefinition[] = [
  {
    name: 'transport_runs_vehicle_id_fk',
    table: 'transport_runs',
    field: 'vehicle_id',
    referencedTable: 'vehicles',
    onDelete: 'RESTRICT',
  },
  {
    name: 'transport_runs_departure_city_id_fk',
    table: 'transport_runs',
    field: 'departure_city_id',
    referencedTable: 'departure_cities',
    onDelete: 'SET NULL',
  },
  {
    name: 'shipments_chinese_client_id_fk',
    table: 'shipments',
    field: 'chinese_client_id',
    referencedTable: 'chinese_clients',
    onDelete: 'RESTRICT',
  },
  {
    name: 'shipments_company_id_fk',
    table: 'shipments',
    field: 'company_id',
    referencedTable: 'our_companies',
    onDelete: 'RESTRICT',
  },
  {
    name: 'shipments_contract_id_fk',
    table: 'shipments',
    field: 'contract_id',
    referencedTable: 'contracts',
    onDelete: 'SET NULL',
  },
  {
    name: 'shipments_customs_warehouse_id_fk',
    table: 'shipments',
    field: 'customs_warehouse_id',
    referencedTable: 'customs_warehouses',
    onDelete: 'SET NULL',
  },
  {
    name: 'transport_run_shipments_run_id_fk',
    table: 'transport_run_shipments',
    field: 'transport_run_id',
    referencedTable: 'transport_runs',
    onDelete: 'CASCADE',
  },
  {
    name: 'transport_run_shipments_shipment_id_fk',
    table: 'transport_run_shipments',
    field: 'shipment_id',
    referencedTable: 'shipments',
    onDelete: 'RESTRICT',
  },
  {
    name: 'transport_run_managers_run_id_fk',
    table: 'transport_run_managers',
    field: 'transport_run_id',
    referencedTable: 'transport_runs',
    onDelete: 'CASCADE',
  },
  {
    name: 'transport_run_managers_user_id_fk',
    table: 'transport_run_managers',
    field: 'user_id',
    referencedTable: 'users',
    onDelete: 'CASCADE',
  },
  {
    name: 'transport_run_declarants_run_id_fk',
    table: 'transport_run_declarants',
    field: 'transport_run_id',
    referencedTable: 'transport_runs',
    onDelete: 'CASCADE',
  },
  {
    name: 'transport_run_declarants_user_id_fk',
    table: 'transport_run_declarants',
    field: 'user_id',
    referencedTable: 'users',
    onDelete: 'CASCADE',
  },
  {
    name: 'transport_run_parent_links_child_id_fk',
    table: 'transport_run_parent_links',
    field: 'child_run_id',
    referencedTable: 'transport_runs',
    onDelete: 'CASCADE',
  },
  {
    name: 'transport_run_parent_links_parent_id_fk',
    table: 'transport_run_parent_links',
    field: 'parent_run_id',
    referencedTable: 'transport_runs',
    onDelete: 'CASCADE',
  },
  {
    name: 'transport_run_history_run_id_fk',
    table: 'transport_run_history',
    field: 'transport_run_id',
    referencedTable: 'transport_runs',
    onDelete: 'CASCADE',
  },
  {
    name: 'shipment_history_shipment_id_fk',
    table: 'shipment_history',
    field: 'shipment_id',
    referencedTable: 'shipments',
    onDelete: 'CASCADE',
  },
  {
    name: 'shipment_comments_shipment_id_fk',
    table: 'shipment_comments',
    field: 'shipment_id',
    referencedTable: 'shipments',
    onDelete: 'CASCADE',
  },
  {
    name: 'shipment_comment_attachments_comment_id_fk',
    table: 'shipment_comment_attachments',
    field: 'shipment_comment_id',
    referencedTable: 'shipment_comments',
    onDelete: 'CASCADE',
  },
  {
    name: 'shipment_comment_attachments_attachment_id_fk',
    table: 'shipment_comment_attachments',
    field: 'attachment_id',
    referencedTable: 'attachments',
    onDelete: 'CASCADE',
  },
];

const CHECKS = [
  {
    name: 'vehicles_registration_number_format_check',
    table: 'vehicles',
    expression: "registration_number ~ '^[A-Z0-9]{2,32}$'",
  },
  { name: 'transport_runs_run_number_positive_check', table: 'transport_runs', expression: 'run_number > 0' },
  {
    name: 'transport_runs_status_check',
    table: 'transport_runs',
    expression:
      "status IN ('queue','in_work','knr','in_russia','warehouse','submission','clearance','inspection','expertise','release_application','release','release_guarantee_prepare','release_guarantee_badis_answer','release_guarantee_to_customs','release_guarantee_wait_customs','release_security_ktc','release_security_cost_accepted','re_export')",
  },
  { name: 'shipments_shipment_number_positive_check', table: 'shipments', expression: 'shipment_number > 0' },
  {
    name: 'shipments_non_negative_values_check',
    table: 'shipments',
    expression:
      '(invoice_value IS NULL OR invoice_value >= 0) AND (customs_payments_amount IS NULL OR customs_payments_amount >= 0) AND (eco_fee IS NULL OR eco_fee >= 0) AND (ktc_amount IS NULL OR ktc_amount >= 0) AND (ntm_honest_sign_sum IS NULL OR ntm_honest_sign_sum >= 0) AND (goods_count IS NULL OR goods_count >= 0)',
  },
  {
    name: 'transport_run_parent_links_no_self_check',
    table: 'transport_run_parent_links',
    expression: 'child_run_id <> parent_run_id',
  },
] as const;

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.ensureUniqueIndexes();
    for (const definition of FOREIGN_KEYS) {
      await this.ensureForeignKey(definition);
    }
    for (const definition of CHECKS) {
      await this.ensureCheck(definition.table, definition.name, definition.expression);
    }
  }

  async down(): Promise<void> {
    // Integrity constraints are intentionally preserved with user data.
  }

  private async ensureUniqueIndexes(): Promise<void> {
    await this.db.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS vehicles_registration_number_unique ON vehicles(registration_number)',
    );
    await this.db.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS transport_runs_run_number_unique ON transport_runs(run_number)',
    );
    await this.db.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS shipments_shipment_number_unique ON shipments(shipment_number)',
    );
  }

  private async ensureForeignKey(definition: ForeignKeyDefinition): Promise<void> {
    if (await this.constraintExists(definition.name)) {
      return;
    }
    await this.db.sequelize.getQueryInterface().addConstraint(definition.table, {
      fields: [definition.field],
      type: 'foreign key',
      name: definition.name,
      references: { table: definition.referencedTable, field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: definition.onDelete,
    });
  }

  private async ensureCheck(table: string, name: string, expression: string): Promise<void> {
    if (await this.constraintExists(name)) {
      return;
    }
    await this.db.sequelize.query(`ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK (${expression})`);
  }

  private async constraintExists(name: string): Promise<boolean> {
    const [rows] = (await this.db.sequelize.query(
      'SELECT 1 FROM pg_constraint WHERE connamespace = current_schema()::regnamespace AND conname = :name LIMIT 1',
      { replacements: { name } },
    )) as [unknown[], unknown];
    return rows.length > 0;
  }
}
