/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ColumnSettings, TableIdentity } from '../../shared/contracts';
import type { SavedFilter } from '../../shared/filterTemplates';
import type { AuthorizedTable } from './ports';

export interface StoredFilterTemplate {
  id: string;
  userId: string;
  instanceKey: string;
  instanceRootUid: string;
  tableUid: string;
  name: string;
  filter: SavedFilter;
  columnSettings: ColumnSettings;
  revision: number;
}

export interface FilterTemplateConfiguration {
  authorize(identity: TableIdentity): Promise<AuthorizedTable>;
  canUseFilter(identity: TableIdentity, filter: SavedFilter): Promise<boolean>;
}

export interface FilterTemplateRepository {
  list(instanceKey: string, userId: string): Promise<StoredFilterTemplate[]>;
  create(template: Omit<StoredFilterTemplate, 'id'>): Promise<StoredFilterTemplate>;
  change(
    instanceKey: string,
    userId: string,
    id: string,
    transform: (template: StoredFilterTemplate) => StoredFilterTemplate | null,
  ): Promise<void>;
}
