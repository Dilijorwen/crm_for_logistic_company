/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Collection, Database } from '@nocobase/database';

export function catalogSearchTable(database: Database, collection: Collection): string {
  const generator = database.sequelize.getQueryInterface().queryGenerator as {
    quoteTable(tableName: unknown): string;
  };
  return generator.quoteTable(collection.model.getTableName());
}

const attachmentName = `coalesce(nullif("title", ''), "filename", 'Документ')`;
const extension = `coalesce("extname", '')`;
export const attachmentSearchName = `(case when right(lower(${attachmentName}), length(${extension})) = lower(${extension})
  then ${attachmentName} else ${attachmentName} || ${extension} end)`;
