/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { TablePersonalizations } from '../application/TablePersonalizations';
import { NocoBaseTableConfiguration } from '../infrastructure/NocoBaseTableConfiguration';
import {
  NocoBasePersonalizationRepository,
  PERSONALIZATIONS_COLLECTION,
} from '../infrastructure/NocoBasePersonalizationRepository';
import { TablePersonalizationController } from '../interfaces/TablePersonalizationController';

export class TablePersonalizationModule {
  constructor(private readonly plugin: Plugin) {}

  initialize(): void {
    const repository = new NocoBasePersonalizationRepository(this.plugin.db);
    new TablePersonalizationController(
      this.plugin,
      (context, userId) =>
        new TablePersonalizations(new NocoBaseTableConfiguration(this.plugin, context), repository, userId),
      PERSONALIZATIONS_COLLECTION,
    ).register();
  }
}
