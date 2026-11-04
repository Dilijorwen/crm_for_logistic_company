/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { FilterActionModel } from '@nocobase/client';
import type { CollectionBlockModel } from '@nocobase/client';
import type { MultiRecordResource } from '@nocobase/flow-engine';
import { emptyFilter } from '../../../../shared/filterTemplates';
import { templateFilterKey } from '../../../shared/lib';

/** Keeps the native editor; templates are controlled by the table toolbar. */
export class SavedFilterActionModel extends FilterActionModel {
  declare props: FilterActionModel['props'] & { iconOnly?: boolean };
  getTitle() {
    return this.props.iconOnly ? '' : super.getTitle();
  }
}

const filterMetadata = FilterActionModel.meta;
if (!filterMetadata) throw new Error('FilterActionModel metadata is not registered');
SavedFilterActionModel.define(filterMetadata);

SavedFilterActionModel.registerFlow({
  key: 'filterTemplateDefaults',
  sort: 1000,
  steps: {
    initialize: {
      handler(ctx) {
        if (!['TableBlockModel', 'TableSelectModel'].includes(ctx.blockModel?.use || '') || ctx.flowSettingsEnabled)
          return;
        ctx.model.setProps('defaultFilterValue', emptyFilter());
        ctx.model.setProps('filterValue', emptyFilter());
      },
    },
  },
});

SavedFilterActionModel.registerFlow({
  key: 'replaceStandaloneTemplateFilter',
  on: 'submit',
  sort: -1,
  steps: {
    clear: {
      handler(ctx) {
        const block = ctx.blockModel as CollectionBlockModel | undefined;
        const resource = block?.resource as MultiRecordResource | undefined;
        if (!block || !resource) return;
        const key = templateFilterKey(block.uid);
        resource.removeFilterGroup(key);
        block.setFilterActive(key, false);
      },
    },
  },
});
