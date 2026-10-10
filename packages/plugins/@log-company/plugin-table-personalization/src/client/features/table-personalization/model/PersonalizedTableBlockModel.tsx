/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { Space } from 'antd';
import { TableBlockModel, TableColumnModel } from '@nocobase/client';
import type { FlowModel } from '@nocobase/flow-engine';
import type { PersonalizableColumn, TableIdentity } from '../../../../shared/contracts';
import { fixedGroup, record } from '../../../../shared/contracts';
import { TablePersonalizationApi } from '../api/TablePersonalizationApi';
import { applyColumnLayout } from '../lib/columnLayout';
import { ColumnSettingsButton } from '../ui/ColumnSettingsButton';
import { ColumnSettingsDialog } from '../ui/ColumnSettingsDialog';
import { PersonalizationController } from './PersonalizationController';
import { PersonalCollectionColumns } from './PersonalCollectionColumns';

export class PersonalizedTableBlockModel extends TableBlockModel {
  private personalController?: PersonalizationController;
  private personalizationView?: FlowModel['context']['view'];
  private readonly personalColumns = new PersonalCollectionColumns(this);

  get personalization(): PersonalizationController {
    if (!this.personalController) {
      this.personalController = new PersonalizationController(
        new TablePersonalizationApi(this.context.api),
        (data, isCurrent) => this.personalColumns.synchronize(data, isCurrent),
        () => this.personalColumns.clear(),
      );
    }
    return this.personalController;
  }

  getPersonalizationIdentity(): TableIdentity {
    const referencePath: string[] = [];
    const visited = new Set<string>();
    let parent: FlowModel | null = this.parent;
    while (parent && !visited.has(parent.uid)) {
      visited.add(parent.uid);
      if (parent.use === 'ReferenceBlockModel') referencePath.unshift(parent.uid);
      parent = parent.parent;
    }
    return { tableUid: this.uid, referencePath };
  }

  getPersonalizationOwner(): string {
    return JSON.stringify([record(this.context.user).id, this.context.api.auth.role, this.context.acl?.data]);
  }

  onMount(): void {
    super.onMount();
    this.personalization.activate(this.getPersonalizationIdentity(), this.getPersonalizationOwner());
  }

  onUnmount(): void {
    this.closePersonalizationSettings();
    this.personalController?.stop();
    super.onUnmount();
  }

  async openPersonalizationSettings(): Promise<void> {
    if (this.personalizationView || this.context.flowSettingsEnabled) return;
    // The engine's view holder survives toolbar remounts caused by asynchronous column updates.
    const view: FlowModel['context']['view'] & Promise<unknown> = this.context.viewer.dialog({
      title: 'Мои колонки',
      closable: true,
      destroyOnClose: true,
      styles: { body: { maxHeight: '65vh', overflowY: 'auto' } },
      content: (currentView) => <ColumnSettingsDialog model={this} view={currentView} />,
    });
    this.personalizationView = view;
    try {
      await view;
    } finally {
      if (this.personalizationView === view) this.personalizationView = undefined;
    }
  }

  closePersonalizationSettings(): void {
    this.personalizationView?.destroy?.();
    this.personalizationView = undefined;
  }

  getColumns(): ReturnType<TableBlockModel['getColumns']> {
    if (this.context.flowSettingsEnabled) return super.getColumns();
    const controller = this.personalization;
    // Subscribe during the first projection, before activation has loaded the current owner's preferences.
    const data = controller.state.data;
    const settings = controller.matches(this.getPersonalizationIdentity(), this.getPersonalizationOwner())
      ? data?.settings || null
      : null;
    const columns = this.mapSubModels('columns', (column) => {
      const props = column.getColumnProps();
      const isFieldColumn = column instanceof TableColumnModel && column.use === 'TableColumnModel';
      return props
        ? {
            uid: column.uid,
            props: isFieldColumn
              ? { ...props, key: column.uid, hidden: Boolean(props.hidden || column.hidden || column.forbidden) }
              : props,
            canPersonalize: isFieldColumn && !column.hidden && !column.forbidden,
          }
        : null;
    }).filter((column): column is NonNullable<typeof column> => !!column);
    const additional = (data?.columns || []).flatMap((column) => {
      if (
        column.source !== 'collection' ||
        this.mapSubModels('columns', (shared) => shared.fieldPath).includes(column.fieldPath) ||
        !settings?.columnOrder.includes(column.uid) ||
        settings.hiddenColumnUids.includes(column.uid)
      )
        return [];
      const model = this.personalColumns.get(column.uid);
      if (!model) return [];
      const props = model.getColumnProps();
      return props
        ? [
            {
              uid: column.uid,
              canPersonalize: true,
              props: { ...props, key: column.uid, hidden: Boolean(model.hidden || model.forbidden) },
            },
          ]
        : [];
    });
    const rendered = applyColumnLayout([...columns, ...additional], settings).map((column) => column.props);
    return [
      ...rendered.filter((column) => fixedGroup(column.fixed) !== 'right'),
      { key: 'empty' },
      ...rendered.filter((column) => fixedGroup(column.fixed) === 'right'),
    ];
  }

  getPersonalizableColumns(): PersonalizableColumn[] {
    const data = this.personalController?.state.data;
    if (!data) return [];
    const available = new Map(data.columns.map((column) => [column.uid, column]));
    const configured = this.mapSubModels('columns', (column) => {
      const saved = available.get(column.uid);
      if (!saved || column.forbidden || !column.getColumnProps()) return null;
      return {
        ...saved,
        title: typeof column.props.title === 'string' ? column.props.title : saved.title,
        fixed: fixedGroup(column.props.fixed),
      };
    }).filter((column): column is PersonalizableColumn => !!column);
    const sharedPaths = this.mapSubModels('columns', (column) => column.fieldPath);
    const additional = data.columns
      .filter((column) => column.source === 'collection' && !sharedPaths.includes(column.fieldPath))
      .map((column) => ({ ...column, title: this.collection.getField(column.fieldPath)?.title || column.title }));
    return [...configured, ...additional];
  }

  renderComponent(): ReturnType<TableBlockModel['renderComponent']> {
    const rendered = super.renderComponent();
    if (this.context.flowSettingsEnabled || rendered.type !== React.Fragment) return rendered;

    // NocoBase 2.0.60 exposes only a right-hand action slot. Extend its native left Space
    // without replacing the table renderer or inserting an action into the saved schema.
    const [provider, ...content] = React.Children.toArray(rendered.props.children);
    if (!React.isValidElement<{ children?: React.ReactNode }>(provider)) return rendered;
    const toolbar = provider.props.children;
    if (!React.isValidElement<{ children?: React.ReactNode }>(toolbar)) return rendered;
    const [leftActions, ...rightActions] = React.Children.toArray(toolbar.props.children);
    if (!React.isValidElement<{ children?: React.ReactNode }>(leftActions) || leftActions.type !== Space)
      return rendered;

    const personalizedActions = React.cloneElement(
      leftActions,
      undefined,
      <ColumnSettingsButton key="personal-columns" model={this} />,
      leftActions.props.children,
    );
    return React.cloneElement(
      rendered,
      undefined,
      React.cloneElement(
        provider,
        undefined,
        React.cloneElement(toolbar, undefined, personalizedActions, ...rightActions),
      ),
      ...content,
    );
  }
}

// FlowModel metadata belongs to each constructor and is not inherited by replacement classes.
const tableBlockMeta = TableBlockModel.meta;
if (!tableBlockMeta) {
  throw new Error('TableBlockModel metadata is not registered');
}
PersonalizedTableBlockModel.define(tableBlockMeta);
