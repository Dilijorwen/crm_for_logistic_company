/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { autorun } from '@formily/reactive';
import { FlowEngine, FlowModel } from '@nocobase/flow-engine';
import { describe, expect, it } from 'vitest';
import { LogisticsWorkspaceShipmentFieldsGridModel } from '../WorkspaceShipmentFieldsGridModel';

const customsRows = { first: [['declaration'], ['badis']], second: [['payment'], ['date']], third: [['control']] };

function fixture(
  fieldIndex?: number,
  rows: Record<string, string[][]> = customsRows,
  checkboxFields = ['badis', 'control'],
) {
  const flow = new FlowEngine();
  flow.registerModels({
    LogisticsWorkspaceShipmentFieldsGridModel,
    FormItemModel: FlowModel,
    CheckboxFieldModel: FlowModel,
  });
  const fields = Object.values(rows).flat(2);
  const model = flow.createModel<LogisticsWorkspaceShipmentFieldsGridModel>({
    uid: 'shipment-section',
    use: 'LogisticsWorkspaceShipmentFieldsGridModel',
    props: { rows },
    subModels: {
      items: fields.map((uid) => ({
        uid,
        use: 'FormItemModel',
        ...(checkboxFields.includes(uid) && {
          subModels: { field: { uid: `${uid}-check`, use: 'CheckboxFieldModel' } },
        }),
      })),
    },
  });
  if (fieldIndex != null) {
    model.context.defineProperty('fieldIndex', { value: fieldIndex });
    model.context.defineProperty('fieldKey', { value: fieldIndex });
  }
  const visibleRows = () => model.getGridLayout().rows.map((row) => row.cells.flatMap((cell) => cell.items ?? []));
  return { flow, model, visibleRows, field: (uid: string) => flow.getModel(uid) };
}

describe('Раскладка полей поставки', () => {
  const detailsRows = {
    first: [['warehouse'], ['warehouse_date']],
    second: [['manager_comment']],
    third: [['importer'], ['contract']],
    fourth: [['client'], ['scheme']],
  };

  it('растягивает СВХ на всю строку и оставляет комментарий менеджера под ним', () => {
    const { model, visibleRows, field } = fixture(undefined, detailsRows, []);
    field('warehouse_date').hidden = true;
    expect(visibleRows()).toEqual([['warehouse'], ['manager_comment'], ['importer', 'contract'], ['client', 'scheme']]);
    expect(model.getGridLayout().rows[0].sizes).toEqual([24]);
  });

  it('удаляет пустую строку и объединяет поля из двух неполных соседних строк', () => {
    const { model, visibleRows, field } = fixture(undefined, detailsRows, []);
    for (const uid of ['warehouse', 'warehouse_date', 'contract', 'client']) field(uid).hidden = true;
    expect(visibleRows()).toEqual([['manager_comment'], ['importer', 'scheme']]);
    expect(model.getGridLayout().rows[1].sizes).toEqual([12, 12]);
  });

  it('ставит флажки после остальных полей и сохраняет строки обычных полей', () => {
    const { visibleRows, field } = fixture();
    expect(visibleRows()).toEqual([['declaration'], ['payment', 'date'], ['badis', 'control']]);
    field('payment').setProps({ hidden: true });
    field('badis').hidden = true;
    expect(visibleRows()).toEqual([['declaration', 'date'], ['control']]);
  });

  it('исключает скрытые поля из индекса для мобильного рендера', () => {
    const { model, field } = fixture(2);
    model.context.defineProperty('isMobileLayout', { value: true });
    model.getGridLayout();
    field('payment').getFork('2:payment').hidden = true;
    expect(model.getItemUids()).not.toContain('payment');
  });

  it('реагирует на скрытие поля в строке вложенной формы и сохраняет исходную раскладку в конструкторе', () => {
    const { flow, visibleRows, field } = fixture(2);
    const layouts: string[][][] = [];
    const dispose = autorun(() => layouts.push(visibleRows()));
    try {
      const rowField = field('declaration').getFork('2:declaration');
      expect(rowField).toBeDefined();
      const renders = layouts.length;
      rowField.setProps({});
      expect(layouts).toHaveLength(renders);
      rowField.hidden = true;
      expect(layouts.at(-1)).toEqual([
        ['payment', 'date'],
        ['badis', 'control'],
      ]);
      expect(field('declaration').hidden).toBe(false);
      flow.flowSettings.enable();
      expect(visibleRows()).toEqual([['declaration', 'badis'], ['payment', 'date'], ['control']]);
    } finally {
      dispose();
    }
  });
});
