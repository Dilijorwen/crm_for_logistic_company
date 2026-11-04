/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { FilterActionModel } from '@nocobase/client';
import { MultiRecordResource } from '@nocobase/flow-engine';
import { isEmptyFilter, transformFilter } from '@nocobase/utils/client';
import type { FilterGroupType } from '@nocobase/utils/client';
import { PersonalizedTableBlockModel } from '../../../features/table-personalization';
import {
  FilterTemplatesController,
  TableFilterTemplateApi,
  TableTemplatesButton,
} from '../../../features/filter-templates';
import type { TableTemplateHost } from '../../../features/filter-templates';
import type { FilterTemplate, SavedFilter, TableTemplateSnapshot } from '../../../../shared/filterTemplates';
import { emptyFilter } from '../../../../shared/filterTemplates';
import { templateFilterKey } from '../../../shared/lib';

function toNativeFilter(filter: SavedFilter): FilterGroupType {
  return {
    logic: filter.logic,
    items: filter.items.map((item) =>
      'items' in item ? toNativeFilter(item) : { ...item, value: item.value ?? (item.noValue ? true : null) },
    ),
  };
}

export class TableTemplatesBlockModel extends PersonalizedTableBlockModel implements TableTemplateHost {
  private templateController?: FilterTemplatesController;
  private standaloneFilter: SavedFilter = emptyFilter();

  get templates(): FilterTemplatesController {
    if (!this.templateController)
      this.templateController = new FilterTemplatesController(new TableFilterTemplateApi(this.context.api));
    return this.templateController;
  }

  isTemplateOperationBlocked(): boolean {
    return (
      this.personalization.state.isSaving || this.personalization.state.isLoading || this.templates.state.isApplying
    );
  }

  private filterAction(): FilterActionModel | undefined {
    return this.mapSubModels('actions', (action) => (action instanceof FilterActionModel ? action : undefined)).find(
      Boolean,
    );
  }

  async captureTemplateSnapshot(): Promise<TableTemplateSnapshot> {
    const columnSettings = await this.captureColumnSettings();
    const filter: SavedFilter = this.filterAction()?.props.filterValue || this.standaloneFilter;
    return { columnSettings, filter: JSON.parse(JSON.stringify(filter)) as SavedFilter };
  }

  async applyTableTemplate(template?: FilterTemplate): Promise<boolean> {
    this.closePersonalizationSettings();
    const restored = template
      ? await this.personalization.restore(template.columnSettings)
      : await this.personalization.reset();
    if (!restored) throw new Error(this.personalization.state.error || 'Не удалось применить колонки шаблона');
    const filter = JSON.parse(JSON.stringify(template?.filter || emptyFilter())) as SavedFilter;
    const action = this.filterAction();
    if (action) {
      action.setProps('filterValue', toNativeFilter(filter));
      await action.dispatchEvent('submit');
      this.standaloneFilter = emptyFilter();
    } else {
      const resource = this.resource;
      if (!(resource instanceof MultiRecordResource)) throw new Error('Ресурс таблицы недоступен');
      const key = templateFilterKey(this.uid);
      const transformed = transformFilter(toNativeFilter(filter));
      const hasFilter = !isEmptyFilter(transformed);
      if (hasFilter) resource.addFilterGroup(key, transformed);
      else resource.removeFilterGroup(key);
      this.setFilterActive(key, hasFilter);
      resource.setPage(1);
      this.standaloneFilter = filter;
      if (this.getDataLoadingMode() === 'manual' && !this.hasActiveFilters()) {
        resource.setData([]);
        resource.setMeta({ count: 0, hasNext: false });
        resource.loading = false;
      } else await resource.refresh();
    }
    return true;
  }

  onUnmount(): void {
    this.templateController?.stop();
    super.onUnmount();
  }

  protected renderPersonalizationActions(): React.ReactNode {
    return [super.renderPersonalizationActions(), <TableTemplatesButton key="table-templates" model={this} />];
  }
}

const metadata = PersonalizedTableBlockModel.meta;
if (!metadata) throw new Error('TableBlockModel metadata is not registered');
TableTemplatesBlockModel.define(metadata);
