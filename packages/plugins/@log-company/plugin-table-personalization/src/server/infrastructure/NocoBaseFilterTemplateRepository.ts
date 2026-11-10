/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { randomUUID } from 'node:crypto';
import type { Database, Model } from '@nocobase/database';
import type { FilterTemplateRepository, StoredFilterTemplate } from '../application/FilterTemplatePorts';
import type { PreferenceOwner } from '../application/ports';
import { parseRevision, parseSavedFilter, parseTemplateName } from '../domain/FilterTemplate';
import { parseSettings } from '../domain/ColumnPreferences';
import { FilterTemplateError } from '../domain/FilterTemplateError';

export const FILTER_TEMPLATES_COLLECTION = 'lc_table_filter_templates';
export const TEMPLATE_INITIALIZATIONS_COLLECTION = 'lc_table_template_initializations';

function fromRow(row: Model): StoredFilterTemplate {
  return {
    id: String(row.get('id')),
    userId: String(row.get('userId')),
    instanceKey: String(row.get('instanceKey')),
    instanceRootUid: String(row.get('instanceRootUid')),
    tableUid: String(row.get('tableUid')),
    name: parseTemplateName(row.get('name')),
    filter: parseSavedFilter(row.get('filter')),
    columnSettings: parseSettings(row.get('columnSettings')),
    revision: parseRevision(row.get('revision')),
  };
}

function rethrow(error: unknown): never {
  if (error instanceof Error && error.name === 'SequelizeUniqueConstraintError') {
    throw new FilterTemplateError('DUPLICATE_NAME');
  }
  throw error;
}

export class NocoBaseFilterTemplateRepository implements FilterTemplateRepository {
  constructor(private readonly database: Database) {}

  async list(instanceKey: string, userId: string): Promise<StoredFilterTemplate[]> {
    const rows: Model[] = await this.database.getRepository(FILTER_TEMPLATES_COLLECTION).find({
      filter: { instanceKey, userId },
      sort: ['name', 'id'],
    });
    return rows.map(fromRow);
  }

  async initialize(
    owner: PreferenceOwner,
    templates: Pick<StoredFilterTemplate, 'name' | 'filter' | 'columnSettings'>[],
  ): Promise<void> {
    const initializations = this.database.getCollection(TEMPLATE_INITIALIZATIONS_COLLECTION).model;
    const model = this.database.getCollection(FILTER_TEMPLATES_COLLECTION).model;
    await this.database.sequelize.transaction(async (transaction) => {
      const [, created] = await initializations.findOrCreate({
        where: { instanceKey: owner.instanceKey, userId: owner.userId },
        defaults: { ...owner, id: randomUUID() },
        transaction,
      });
      if (created) {
        await model.bulkCreate(
          templates.map((template) => ({ ...owner, ...template, id: randomUUID(), revision: 1 })),
          { transaction, ignoreDuplicates: true },
        );
      }
    });
  }

  async create(template: Omit<StoredFilterTemplate, 'id'>): Promise<StoredFilterTemplate> {
    try {
      const row = await this.database.getRepository(FILTER_TEMPLATES_COLLECTION).create({
        values: {
          ...template,
          id: randomUUID(),
        },
      });
      return fromRow(row);
    } catch (error) {
      return rethrow(error);
    }
  }

  async change(
    instanceKey: string,
    userId: string,
    id: string,
    transform: (template: StoredFilterTemplate) => StoredFilterTemplate | null,
  ): Promise<void> {
    try {
      const model = this.database.getCollection(FILTER_TEMPLATES_COLLECTION).model;
      await this.database.sequelize.transaction(async (transaction) => {
        const row = await model.findOne({
          where: { instanceKey, userId, id },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!row) throw new FilterTemplateError('NOT_FOUND');
        const updated = transform(fromRow(row));
        if (!updated) await row.destroy({ transaction });
        else
          await row.update(
            {
              name: updated.name,
              filter: updated.filter,
              columnSettings: updated.columnSettings,
              revision: updated.revision,
            },
            { transaction },
          );
      });
    } catch (error) {
      rethrow(error);
    }
  }
}
