/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Application, TableBlockModel } from '@nocobase/client';
import { MultiRecordResource } from '@nocobase/flow-engine';
import { describe, expect, it } from 'vitest';
import { TableTemplatesBlockModel } from '../../../../../../../plugin-table-personalization/src/client/widgets/table-templates';
import type { WorkspaceRow } from '../../../../../shared/workspace';
import { LogisticsWorkspaceTableBlockModel } from '../WorkspaceTableBlockModel';

function setup() {
  const app = new Application();
  const engine = app.flowEngine;
  engine.context.defineProperty('app', { value: app });
  engine.context.defineProperty('view', { value: { inputArgs: {} } });
  engine.context.dataSourceManager.getDataSource('main')?.addCollection({
    name: 'logistics_work_items',
    filterTargetKey: 'id',
    fields: [
      { name: 'id', type: 'string', interface: 'input' },
      { name: 'shipment_number', type: 'integer', interface: 'integer' },
    ],
  });
  engine.registerModels({ LogisticsWorkspaceTableBlockModel, TableBlockModel: TableTemplatesBlockModel });
  const owner = engine.createModel({
    uid: 'workspace',
    use: 'LogisticsWorkspaceTableBlockModel',
    subModels: {
      table: {
        uid: 'native-table',
        use: 'TableBlockModel',
        stepParams: { resourceSettings: { init: { dataSourceKey: 'main', collectionName: 'logistics_work_items' } } },
      },
    },
  }) as LogisticsWorkspaceTableBlockModel;
  const table = owner.subModels.table as unknown as TableBlockModel;
  return { owner, table, resource: table.resource as MultiRecordResource<WorkspaceRow> };
}

describe('workspace integration with native columns and templates', () => {
  it('initializes grouping before the native resource makes its first request', () => {
    const { resource, table } = setup();
    expect(resource.getRequestParameter('workspaceGroupByRun')).toBe(true);
    expect(table.use).toBe('TableBlockModel');
    expect(table).toBeInstanceOf(TableTemplatesBlockModel);
  });

  it('synchronizes shared selections through the unchanged native resource', () => {
    const { resource } = setup();
    resource.setData([{ id: '10:100' }, { id: '11:100' }, { id: '10:101' }, { id: '12:0' }]);
    resource.setSelectedRows([{ id: '10:100' }]);
    expect(resource.getSelectedRows().map((row) => row.id)).toEqual(['10:100', '11:100']);
    resource.setSelectedRows([{ id: '11:100' }]);
    expect(resource.getSelectedRows()).toEqual([]);
  });

  it('keeps selection state and resolves current link metadata without mutating the root view', () => {
    const { owner, table, resource } = setup();
    resource.setMeta({
      workspace: {
        shipmentCount: 1,
        runTotals: { '10': 1 },
        shipmentRuns: {
          '100': [
            { id: '10', run_number: 30 },
            { id: '11', run_number: 31 },
          ],
        },
      },
    });
    const select = table.context.selectWorkspaceRun as (id: string) => void;
    const getLinks = table.context.getWorkspaceShipmentRuns as (id: string) => unknown[];
    select('10');
    expect(owner.workspaceState.selectedRunId).toBe('10');
    expect(getLinks('100')).toHaveLength(2);
    expect(table.flowEngine.context.view.inputArgs).toEqual({});
    expect(
      (table.rowSelectionProps as { getCheckboxProps(row: WorkspaceRow): { disabled: boolean } }).getCheckboxProps({
        id: 'run:10',
      }).disabled,
    ).toBe(true);
  });
});
