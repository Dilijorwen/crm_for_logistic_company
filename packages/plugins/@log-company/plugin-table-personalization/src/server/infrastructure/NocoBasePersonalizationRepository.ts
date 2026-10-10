/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database } from '@nocobase/database';
import type { ColumnSettings } from '../../shared/contracts';
import type { PersonalizationRepository, PreferenceOwner } from '../application/ports';
import { parseSettings } from '../domain/ColumnPreferences';

export const PERSONALIZATIONS_COLLECTION = 'lc_table_personalizations';

export class NocoBasePersonalizationRepository implements PersonalizationRepository {
  constructor(private readonly database: Database) {}

  async find(owner: PreferenceOwner): Promise<ColumnSettings | null> {
    const row = await this.database.getRepository(PERSONALIZATIONS_COLLECTION).findOne({
      filter: { userId: owner.userId, instanceKey: owner.instanceKey },
      fields: ['settings'],
    });
    return row ? parseSettings(row.get('settings')) : null;
  }

  async save(owner: PreferenceOwner, settings: ColumnSettings): Promise<void> {
    await this.update(owner, () => settings);
  }

  async update(
    owner: PreferenceOwner,
    transform: (previous: ColumnSettings | null) => ColumnSettings,
  ): Promise<ColumnSettings> {
    const model = this.database.getCollection(PERSONALIZATIONS_COLLECTION).model;
    return this.database.sequelize.transaction(async (transaction) => {
      // The unique owner/instance key serializes creation; the row lock protects unrelated preference parameters.
      await model.bulkCreate([{ ...owner, settings: transform(null) }], {
        validate: true,
        ignoreDuplicates: true,
        transaction,
      });
      const row = await model.findOne({
        where: { userId: owner.userId, instanceKey: owner.instanceKey },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!row) throw new Error('Personalization record disappeared during update');
      const settings = transform(parseSettings(row.get('settings')));
      await row.update({ settings }, { transaction });
      return settings;
    });
  }

  async reset(owner: PreferenceOwner): Promise<void> {
    await this.database.getRepository(PERSONALIZATIONS_COLLECTION).destroy({
      filter: { userId: owner.userId, instanceKey: owner.instanceKey },
    });
  }
}
