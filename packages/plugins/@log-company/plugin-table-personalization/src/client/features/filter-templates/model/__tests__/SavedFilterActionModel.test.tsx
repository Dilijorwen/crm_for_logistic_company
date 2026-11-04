/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { FilterActionModel, FilterContent, TableBlockModel } from '@nocobase/client';
import { FlowEngine } from '@nocobase/flow-engine';
import { Popover } from 'antd';
import { describe, expect, it, vi } from 'vitest';
import { SavedFilterActionModel } from '../SavedFilterActionModel';
import { emptyFilter } from '../../../../../shared/filterTemplates';

function fixture() {
  const engine = new FlowEngine();
  const block = new TableBlockModel({ uid: 'table', use: 'TableBlockModel', flowEngine: engine });
  const model = new SavedFilterActionModel({ uid: 'filter', use: 'FilterActionModel', flowEngine: engine });
  model.context.defineProperty('blockModel', { value: block });
  return { model, block };
}

describe('native filter after moving templates to the table toolbar', () => {
  it('inherits the native filter editor without template controls', () => {
    const { model } = fixture();
    const rendered = FilterActionModel.prototype.render.call(model);
    expect(rendered.type).toBe(Popover);
    expect(SavedFilterActionModel.meta?.label).toBe(FilterActionModel.meta?.label);
    expect(rendered.props.content.type).toBe(FilterContent);
    expect(Object.hasOwn(SavedFilterActionModel.prototype, 'render')).toBe(false);
  });

  it('starts with zero conditions', async () => {
    const { model } = fixture();
    model.setProps('filterValue', { logic: '$and', items: [{ path: 'id', operator: '$eq', value: 1 }] });
    await model.applyFlow('filterTemplateDefaults');
    expect(model.props.filterValue).toEqual(emptyFilter());
    expect(model.props.defaultFilterValue).toEqual(emptyFilter());
  });

  it('removes a template filter applied before a native filter button was added', async () => {
    const { model, block } = fixture();
    const removeFilterGroup = vi.fn();
    const setFilterActive = vi.fn();
    block.context.defineProperty('resource', { value: { removeFilterGroup } });
    Object.assign(block, { setFilterActive });
    await model.applyFlow('replaceStandaloneTemplateFilter');
    expect(removeFilterGroup).toHaveBeenCalledWith('lc_table_template:table');
    expect(setFilterActive).toHaveBeenCalledWith('lc_table_template:table', false);
  });
});
