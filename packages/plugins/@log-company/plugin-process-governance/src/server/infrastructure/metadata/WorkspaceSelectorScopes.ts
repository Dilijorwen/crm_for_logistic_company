/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { WorkspaceFlowTree } from './LogisticsWorkspaceNativeModels';

const active = { path: 'is_active', operator: '$isTruly', value: true, noValue: true };
const scopedSelectModel = 'LogisticsWorkspaceScopedSelectFieldModel';

function scopeRules(item: WorkspaceFlowTree) {
  const init = (item.stepParams?.fieldSettings as { init?: { collectionName?: string; fieldPath?: string } })?.init;
  if (!init?.fieldPath) return [];
  if (init.collectionName === 'transport_runs' && init.fieldPath === 'declarants')
    return [{ path: 'roles.title', operator: '$eq', value: 'Декларант', noValue: false }];

  const nested = init.collectionName === 'transport_runs' && init.fieldPath.startsWith('shipments.');
  if (!nested && init.collectionName !== 'shipments') return [];
  const name = nested ? init.fieldPath.slice('shipments.'.length) : init.fieldPath;
  if (name === 'company' || name === 'chinese_client' || name === 'customs_warehouse') return [active];
  if (name !== 'contract_record') return [];

  return [
    {
      path: 'importers.id',
      operator: '$eq',
      value: nested ? '{{ ctx.item.value.company.id }}' : '{{ ctx.formValues.company.id }}',
      noValue: false,
    },
    { path: 'importers.id', operator: '$notEmpty', value: true, noValue: true },
    active,
  ];
}

export function workspaceSelectorUpdate(
  item: WorkspaceFlowTree,
): Pick<WorkspaceFlowTree, 'uid' | 'use' | 'stepParams'> | null {
  const field = item.subModels?.field;
  if (!field || Array.isArray(field) || !['RecordSelectFieldModel', scopedSelectModel].includes(field.use)) return null;
  const rules = scopeRules(item);
  if (!rules.length) return null;
  const select = field.stepParams?.selectSettings as Record<string, unknown> | undefined;
  const dataScope = select?.dataScope as Record<string, unknown> | undefined;
  const previous = dataScope?.filter as { logic?: string; items?: unknown[] } | undefined;
  const existing = previous?.items ?? [];
  const otherRules =
    previous?.logic === '$and'
      ? existing.filter((entry) => {
          const rule = entry as { path?: string; operator?: string } | null;
          return !rules.some(({ path, operator }) => rule?.path === path && rule?.operator === operator);
        })
      : existing.length
        ? [previous]
        : [];
  const filter = { logic: '$and', items: [...rules, ...otherRules] };
  if (field.use === scopedSelectModel && JSON.stringify(previous) === JSON.stringify(filter)) return null;
  return {
    uid: field.uid,
    use: scopedSelectModel,
    stepParams: { ...field.stepParams, selectSettings: { ...select, dataScope: { ...dataScope, filter } } },
  };
}
