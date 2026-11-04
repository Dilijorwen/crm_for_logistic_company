/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import type { TableBlockModel } from '@nocobase/client';
import type { WorkspaceRunGroup } from './workspaceGroups';

export interface WorkspaceTableState {
  table: TableBlockModel;
  groups: WorkspaceRunGroup[];
  selectedRunId?: string;
  collapsedRunIds: string[];
  selectRun(id: string): void;
  toggleRun(id: string): void;
}

export const WorkspaceTableContext = React.createContext<WorkspaceTableState | null>(null);

export function useWorkspaceTable(): WorkspaceTableState {
  const context = React.useContext(WorkspaceTableContext);
  if (!context) throw new Error('Workspace table is not mounted');
  return context;
}
