/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export interface WorkspaceRow extends Record<string, unknown> {
  id: string;
  workspaceHeader?: boolean;
}

export interface WorkspaceRunLink {
  id: string;
  run_number?: number;
  registration_number?: string;
  transport_type?: string;
  departure_city_name?: string;
}

export interface WorkspaceTableMeta {
  shipmentCount: number;
  runTotals: Record<string, number>;
  shipmentRuns: Record<string, WorkspaceRunLink[]>;
}
export const WORKSPACE_RUN_VIEW_UID = 'lcwsrecordpopup';
export const WORKSPACE_SHIPMENT_VIEW_UID = 'lcwsshippagepopup';
export const WORKSPACE_CREATE_SHIPMENT_VIEW_UID = 'lcwsnewshipment';
