/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  SHIPMENT_GENERAL,
  SHIPMENT_CUSTOMS,
  SHIPMENT_NTM,
  type WorkspaceFlowTree,
} from './LogisticsWorkspaceNativeModels';

export const SHIPMENT_FORM_SECTIONS = [
  {
    title: 'Основное',
    fields: SHIPMENT_GENERAL.filter(
      (field) => !['customs_scheme', 'customs_warehouse', 'customs_warehouse_storage_date'].includes(field),
    ),
  },
  {
    title: 'Таможенное оформление',
    fields: ['customs_scheme', 'customs_warehouse', 'customs_warehouse_storage_date', ...SHIPMENT_CUSTOMS],
  },
  { title: 'НТМ', fields: SHIPMENT_NTM },
];

/** Move existing field models, keeping their identifiers, validation and designer settings. */
export function shipmentCreationSections(grid: WorkspaceFlowTree): WorkspaceFlowTree[] {
  const fields = grid.subModels?.items;
  if (!Array.isArray(fields)) throw new Error('Не найдены поля формы создания поставки.');
  const remaining = new Set(fields);
  const definitions = SHIPMENT_FORM_SECTIONS.map((section) => ({
    title: section.title,
    fields: fields.filter((item) => {
      const setting = item.stepParams?.fieldSettings as { init?: { fieldPath?: string } } | undefined;
      return section.fields.includes(setting?.init?.fieldPath || '');
    }),
  }));
  for (const definition of definitions) for (const field of definition.fields) remaining.delete(field);
  if (remaining.size) definitions.push({ title: 'Дополнительно', fields: [...remaining] });
  return definitions.map((definition, index) => ({
    uid: `${grid.uid}section${index}`,
    use: 'FormGridModel',
    props: { workspaceSectionTitle: definition.title },
    stepParams: {
      gridSettings: {
        grid: {
          rows: Object.fromEntries(
            Array.from({ length: Math.ceil(definition.fields.length / 2) }, (_, row) => [
              `${grid.uid}section${index}row${row}`,
              definition.fields.slice(row * 2, row * 2 + 2).map((field) => [field.uid]),
            ]),
          ),
        },
      },
    },
    subModels: { items: definition.fields },
  }));
}
