/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ColumnSettings, PersonalizableColumn, TableIdentity } from '../../shared/contracts';

export interface PreferenceOwner {
  userId: string;
  instanceKey: string;
  instanceRootUid: string;
  tableUid: string;
}

export interface AuthorizedTable {
  instanceKey: string;
  instanceRootUid: string;
  tableUid: string;
  schemaSignature: string;
  columns: PersonalizableColumn[];
  existingColumnUids: string[];
  resizableColumnUids?: string[];
}

export interface TableConfigurationGateway {
  authorize(identity: TableIdentity): Promise<AuthorizedTable>;
}

export interface PersonalizationRepository {
  find(owner: PreferenceOwner): Promise<ColumnSettings | null>;
  save(owner: PreferenceOwner, settings: ColumnSettings): Promise<void>;
  update(
    owner: PreferenceOwner,
    transform: (previous: ColumnSettings | null) => ColumnSettings,
  ): Promise<ColumnSettings>;
  reset(owner: PreferenceOwner): Promise<void>;
}
