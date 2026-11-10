/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Model, Transaction } from '@nocobase/database';
import { Migration } from '@nocobase/server';
import { LOGISTICS_COLLECTIONS, LOGISTICS_STATUS_LABELS, LOGISTICS_STATUS_OPTIONS } from '../../shared/logistics';

const COLLECTIONS = [LOGISTICS_COLLECTIONS.shipments, LOGISTICS_COLLECTIONS.workItems];
const WORKSPACE_STATUS_FIELD_UID = 'lclogworkfield8';

const OLD_STATUS_LABELS = {
  in_russia: 'В России',
  submission: 'Подача',
  clearance: 'Оформление',
  release_application: 'Заявление на выпуск',
  release_guarantee_prepare: 'Подготовка обеспечения',
  release_guarantee_badis_answer: 'Ответ БАДИС по обеспечению',
  release_guarantee_to_customs: 'Обеспечение направлено в таможню',
  release_guarantee_wait_customs: 'Ожидание таможни по обеспечению',
  release_security_ktc: 'Обеспечение КТС',
  release_security_cost_accepted: 'Стоимость обеспечения принята',
} as const;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function updateOptions(options: unknown) {
  const previous = new Map(
    (Array.isArray(options) ? options : []).map((option: unknown) => {
      const entry = record(option);
      return [entry.value, entry];
    }),
  );
  return LOGISTICS_STATUS_OPTIONS.map((option) => ({ ...previous.get(option.value), ...option }));
}

interface QueryGenerator {
  quoteTable(tableName: unknown): string;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.db.sequelize.transaction(async (transaction) => {
      const fields: Model[] = await this.db.getRepository('fields').find({
        filter: { collectionName: { $in: COLLECTIONS }, name: 'status' },
        transaction,
      });
      for (const field of fields) {
        const options = record(field.get('options'));
        const uiSchema = record(options.uiSchema);
        await field.update(
          { options: { ...options, uiSchema: { ...uiSchema, enum: updateOptions(uiSchema.enum) } } },
          { transaction, hooks: false },
        );
      }

      const flowModels = this.db.getCollection('flowModels');
      const status = await flowModels.model.findByPk(WORKSPACE_STATUS_FIELD_UID, { transaction });
      if (status) {
        const options = record(status.get('options'));
        const props = record(options.props);
        await status.update(
          { options: { ...options, props: { ...props, options: updateOptions(props.options) } } },
          { transaction, hooks: false },
        );
      }
      await this.updateInitialTemplateNames(transaction);
    });
  }

  private async updateInitialTemplateNames(transaction: Transaction): Promise<void> {
    const templates = this.db.getCollection('lc_table_filter_templates');
    const initializations = this.db.getCollection('lc_table_template_initializations');
    if (!templates || !initializations) return;

    const generator = this.db.sequelize.getQueryInterface().queryGenerator as unknown as QueryGenerator;
    const templatesTable = generator.quoteTable(templates.model.getTableName());
    const initializationsTable = generator.quoteTable(initializations.model.getTableName());
    const flowModelsTable = generator.quoteTable(this.db.getCollection('flowModels').model.getTableName());
    const renames = LOGISTICS_STATUS_OPTIONS.flatMap(({ value, label }) =>
      Object.prototype.hasOwnProperty.call(OLD_STATUS_LABELS, value)
        ? [{ value, old_name: OLD_STATUS_LABELS[value as keyof typeof OLD_STATUS_LABELS], new_name: label }]
        : [],
    );
    // Serialize the name-collision check with template writes during the one-time upgrade.
    await this.db.sequelize.query(`LOCK TABLE ${templatesTable} IN SHARE ROW EXCLUSIVE MODE`, { transaction });
    await this.db.sequelize.query(
      `UPDATE ${templatesTable} AS template
        SET name = rename.new_name, revision = template.revision + 1, "updatedAt" = CURRENT_TIMESTAMP
        FROM jsonb_to_recordset(CAST(:renames AS jsonb)) AS rename(value text, old_name text, new_name text),
             ${flowModelsTable} AS flow
        WHERE flow.uid = template."tableUid"
          AND COALESCE(flow.options #>> '{stepParams,resourceSettings,init,dataSourceKey}', 'main') = 'main'
          AND flow.options #>> '{stepParams,resourceSettings,init,collectionName}' IN (:collections)
          AND template.name = rename.old_name
          AND template.filter::jsonb = jsonb_build_object('logic', '$and', 'items',
            jsonb_build_array(jsonb_build_object('path', 'status', 'operator', '$eq', 'value', rename.value)))
          AND EXISTS (SELECT 1 FROM ${initializationsTable} AS initialized
            WHERE initialized."userId" = template."userId" AND initialized."instanceKey" = template."instanceKey")
          AND NOT EXISTS (SELECT 1 FROM ${templatesTable} AS existing
            WHERE existing."userId" = template."userId" AND existing."instanceKey" = template."instanceKey"
              AND existing.name = rename.new_name)`,
      { transaction, replacements: { renames: JSON.stringify(renames), collections: COLLECTIONS } },
    );
  }
}
