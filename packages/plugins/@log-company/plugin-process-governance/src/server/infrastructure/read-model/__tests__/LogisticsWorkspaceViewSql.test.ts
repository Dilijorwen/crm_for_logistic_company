/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { LOGISTICS_WORKSPACE_VIEW_SQL } from '../LogisticsWorkspaceViewSql';

describe('LOGISTICS_WORKSPACE_VIEW_SQL', () => {
  it('projects every run-shipment link and keeps runs without shipments', () => {
    expect(LOGISTICS_WORKSPACE_VIEW_SQL).toContain('CREATE OR REPLACE VIEW public.logistics_work_items');
    expect(LOGISTICS_WORKSPACE_VIEW_SQL).toContain('LEFT JOIN transport_run_shipments link');
    expect(LOGISTICS_WORKSPACE_VIEW_SQL).toContain("COALESCE(link.shipment_id::text, '0')");
  });

  it('provides the combined navigation and customs fields without a second source of truth', () => {
    expect(LOGISTICS_WORKSPACE_VIEW_SQL).toContain('vehicle.registration_number');
    expect(LOGISTICS_WORKSPACE_VIEW_SQL).toContain('manager_list.names AS manager_names');
    expect(LOGISTICS_WORKSPACE_VIEW_SQL).toContain('shipment.declaration_number');
    expect(LOGISTICS_WORKSPACE_VIEW_SQL).not.toContain('INSERT INTO');
    expect(LOGISTICS_WORKSPACE_VIEW_SQL).not.toContain('DELETE FROM');
  });
});
