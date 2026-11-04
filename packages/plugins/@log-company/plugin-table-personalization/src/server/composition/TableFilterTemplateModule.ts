/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { TableFilterTemplates } from '../application/TableFilterTemplates';
import { NocoBaseTableConfiguration } from '../infrastructure/NocoBaseTableConfiguration';
import {
  FILTER_TEMPLATES_COLLECTION,
  NocoBaseFilterTemplateRepository,
} from '../infrastructure/NocoBaseFilterTemplateRepository';
import { TableFilterTemplateController } from '../interfaces/TableFilterTemplateController';

export class TableFilterTemplateModule {
  constructor(private readonly plugin: Plugin) {}

  initialize(): void {
    const repository = new NocoBaseFilterTemplateRepository(this.plugin.db);
    new TableFilterTemplateController(
      this.plugin,
      (context, userId) =>
        new TableFilterTemplates(new NocoBaseTableConfiguration(this.plugin, context), repository, userId),
      FILTER_TEMPLATES_COLLECTION,
    ).register();
  }
}
