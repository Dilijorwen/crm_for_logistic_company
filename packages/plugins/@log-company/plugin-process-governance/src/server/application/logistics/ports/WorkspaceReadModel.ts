/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { WorkspaceTableMeta } from '../../../../shared/workspace';

export interface WorkspacePageQuery {
  filter: Record<string, unknown>;
  scopeFilter: Record<string, unknown>;
  fields: string[];
  sort: string[];
  page: number;
  pageSize: number;
}

export interface WorkspacePage {
  rows: Record<string, unknown>[];
  count: number;
  page: number;
  pageSize: number;
  totalPage: number;
  workspace: WorkspaceTableMeta;
}

export interface WorkspaceReadModel {
  findPage(query: WorkspacePageQuery): Promise<WorkspacePage>;
}
