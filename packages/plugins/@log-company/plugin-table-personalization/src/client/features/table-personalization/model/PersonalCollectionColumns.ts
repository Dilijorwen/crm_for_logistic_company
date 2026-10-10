/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { TableBlockModel, TableColumnModel } from '@nocobase/client';
import type { TablePersonalization } from '../../../../shared/contracts';
import { setPersonalColumnUid } from './columnWidthBinding';

// Runtime-only field models stay outside subModels, so serializing the table never saves personal columns.
export class PersonalCollectionColumns {
  private models = new Map<string, TableColumnModel>();
  private ownedAppends: string[] = [];
  private ownedFields: string[] = [];
  private pending: Promise<void> = Promise.resolve();

  constructor(private readonly table: TableBlockModel) {}

  get(uid: string): TableColumnModel | undefined {
    return this.models.get(uid);
  }

  synchronize(data: TablePersonalization, isCurrent: () => boolean): Promise<void> {
    const prepare = () => this.prepare(data, isCurrent);
    // A failed preparation is reported to its caller; the next request must still be able to retry.
    this.pending = this.pending.then(prepare, prepare);
    return this.pending;
  }

  clear(): void {
    for (const model of this.models.values()) this.table.flowEngine.removeModelWithSubModels(model.uid);
    this.models.clear();
    if (this.ownedAppends.length)
      this.table.resource.removeAppends(this.ownedAppends.filter((name) => !this.isSharedAppend(name)));
    if (this.ownedFields.length)
      this.table.resource.setFields(
        this.table.resource.getFields().filter((name) => !this.ownedFields.includes(name) || this.isSharedAppend(name)),
      );
    this.ownedAppends = [];
    this.ownedFields = [];
  }

  private isSharedAppend(append: string): boolean {
    const path = append.split('(')[0];
    return this.table
      .mapSubModels('columns', (column) => column.fieldPath)
      .some((fieldPath) => typeof fieldPath === 'string' && (fieldPath === path || fieldPath.startsWith(`${path}.`)));
  }

  private async prepare(data: TablePersonalization, isCurrent: () => boolean): Promise<void> {
    if (!isCurrent()) return;
    const selected = data.columns.filter(
      (column) =>
        column.source === 'collection' &&
        !this.table.mapSubModels('columns', (shared) => shared.fieldPath).includes(column.fieldPath) &&
        data.settings?.columnOrder.includes(column.uid) &&
        !data.settings.hiddenColumnUids.includes(column.uid),
    );
    if ((!selected.length && !this.models.size) || this.table.context.flowSettingsEnabled) return;
    const resource = this.table.resource;
    const previousAppends = [...resource.getAppends()];
    const previousFields = [...resource.getFields()];
    const staged = new Map<string, TableColumnModel>();
    let newFields: string[] = [];
    let obsoleteAppends: string[] = [];
    try {
      for (const column of selected) {
        const field = this.table.collection.getField(column.fieldPath);
        if (!field) throw new Error('Метаданные поля изменились. Обновите страницу');
        const binding = TableColumnModel.getDefaultBindingByField(this.table.context, field, {
          fallbackToTargetTitleField: true,
        });
        const use = binding?.modelName || 'DisplayJSONFieldModel';
        const defaultProps =
          typeof binding?.defaultProps === 'function'
            ? binding.defaultProps(this.table.context, field)
            : binding?.defaultProps;
        const created = this.table.flowEngine.createModel({
          use: 'TableColumnModel',
          parentId: this.table.uid,
          stepParams: {
            fieldSettings: {
              init: {
                dataSourceKey: this.table.collection.dataSourceKey,
                collectionName: this.table.collection.name,
                fieldPath: column.fieldPath,
              },
            },
            tableColumnSettings: {
              title: { title: column.title },
              width: { width: 150 },
              quickEdit: { editable: false },
              model: { use },
              fieldNames: { label: field.targetCollectionTitleFieldName || field.name },
            },
          },
          subModels: {
            field: {
              use,
              props: { ...defaultProps },
              stepParams: { displayFieldSettings: { clickToOpen: { clickToOpen: false } } },
            },
          },
        });
        if (!(created instanceof TableColumnModel)) throw new Error('Не удалось создать модель столбца');
        const model = created;
        setPersonalColumnUid(model, column.uid);
        staged.set(column.uid, model);
        await model.dispatchEvent('beforeRender');
      }
      if (!isCurrent()) return;
      const newAppends = resource.getAppends().filter((name) => !previousAppends.includes(name));
      newFields = previousFields.length
        ? selected.filter((column) => !previousFields.includes(column.fieldPath)).map((column) => column.fieldPath)
        : [];
      obsoleteAppends = this.ownedAppends.filter(
        (name) =>
          !this.isSharedAppend(name) &&
          !selected.some(
            (column) => name.split('(')[0] === column.fieldPath || name.startsWith(`${column.fieldPath}.`),
          ),
      );
      resource.removeAppends(obsoleteAppends);
      const fields = previousFields.filter(
        (name) =>
          !this.ownedFields.includes(name) ||
          this.isSharedAppend(name) ||
          selected.some((column) => column.fieldPath === name),
      );
      if (previousFields.length) resource.setFields([...fields, ...newFields]);
      if (newAppends.length || obsoleteAppends.length || newFields.length || fields.length !== previousFields.length)
        await resource.refresh();
      if (!isCurrent()) return;
      for (const model of this.models.values()) this.table.flowEngine.removeModelWithSubModels(model.uid);
      this.models = staged;
      this.ownedAppends = [...this.ownedAppends.filter((name) => !obsoleteAppends.includes(name)), ...newAppends];
      this.ownedFields = [...this.ownedFields.filter((name) => fields.includes(name)), ...newFields];
    } finally {
      if (this.models !== staged) {
        for (const model of staged.values()) this.table.flowEngine.removeModelWithSubModels(model.uid);
        resource.removeAppends(
          resource.getAppends().filter((name) => !previousAppends.includes(name) && !this.isSharedAppend(name)),
        );
        if (isCurrent()) {
          resource.addAppends(obsoleteAppends);
          if (previousFields.length) resource.setFields(previousFields);
        } else if (newFields.length) {
          resource.setFields(resource.getFields().filter((name) => !newFields.includes(name)));
        }
      }
    }
  }
}
