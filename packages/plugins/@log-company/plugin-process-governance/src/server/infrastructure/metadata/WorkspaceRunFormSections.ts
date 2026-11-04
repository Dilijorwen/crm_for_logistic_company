/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { WorkspaceFlowTree } from './LogisticsWorkspaceNativeModels';

const SECTIONS = [
  { title: 'Основные данные', fields: ['transport_type', 'registration_number_input', 'departure_city'] },
  { title: 'Ответственные', fields: ['managers', 'declarants'] },
  { title: 'Связи рейсов', fields: ['parent_runs'] },
];

/** Native dividers and native form items keep a single form, validation and submit. */
export function workspaceRunFormSections(grid: WorkspaceFlowTree): WorkspaceFlowTree {
  const items = grid.subModels?.items;
  if (!Array.isArray(items) || items.some((item) => item.uid === `${grid.uid}section0`)) return grid;
  const remaining = new Set(items);
  const sections = SECTIONS.map((section) => ({
    title: section.title,
    items: items.filter((item) => {
      const settings = item.stepParams?.fieldSettings as { init?: { fieldPath?: string } } | undefined;
      const field = settings?.init;
      return Boolean(field?.fieldPath && section.fields.includes(field.fieldPath));
    }),
  }));
  for (const section of sections) for (const item of section.items) remaining.delete(item);
  if (remaining.size) sections.push({ title: 'Дополнительно', items: [...remaining] });
  const rows: Record<string, string[][]> = {};
  const grouped: WorkspaceFlowTree[] = [];
  for (const [index, section] of sections.entries()) {
    if (!section.items.length) continue;
    const uid = `${grid.uid}section${index}`;
    grouped.push({
      uid,
      use: 'DividerItemModel',
      stepParams: { markdownItemSetting: { title: { label: section.title, orientation: 'left' } } },
    });
    rows[uid] = [[uid]];
    grouped.push(...section.items);
    for (let offset = 0; offset < section.items.length; offset += 2)
      rows[`${uid}row${offset}`] = section.items.slice(offset, offset + 2).map((item) => [item.uid]);
  }
  const configuredSettings = grid.stepParams?.gridSettings;
  const settings =
    configuredSettings && typeof configuredSettings === 'object' && !Array.isArray(configuredSettings)
      ? configuredSettings
      : {};
  return {
    ...grid,
    stepParams: { ...grid.stepParams, gridSettings: { ...settings, grid: { rows } } },
    subModels: { ...grid.subModels, items: grouped },
  };
}
