/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { FlowModel } from '@nocobase/flow-engine';
import type { ForkFlowModel, ModelConstructor } from '@nocobase/flow-engine';
import type { TableColumnProps } from 'antd';
import type { TableIdentity } from '../../../../shared/contracts';
import { record, RESIZABLE_TABLE_MODELS } from '../../../../shared/contracts';
import { TablePersonalizationApi } from '../api/TablePersonalizationApi';
import { PersonalizationController } from './PersonalizationController';
import { ColumnWidthHeader } from '../ui/ColumnWidthHeader';

const tableControllers = new WeakMap<FlowModel, { controller: PersonalizationController; headers: number }>();
const logicalColumnUids = new WeakMap<object, string>();
const widthForks = new WeakMap<FlowModel, ForkFlowModel<FlowModel>>();

export function setPersonalColumnUid(model: object, uid: string): void {
  logicalColumnUids.set(model, uid);
}

export function tableIdentity(table: FlowModel): TableIdentity {
  const referencePath: string[] = [];
  const visited = new Set<string>();
  let parent = table.parent;
  while (parent && !visited.has(parent.uid)) {
    visited.add(parent.uid);
    if (parent.use === 'ReferenceBlockModel') referencePath.unshift(parent.uid);
    parent = parent.parent;
  }
  return { tableUid: table.uid, referencePath };
}

export function tableOwner(table: FlowModel): string {
  return JSON.stringify([record(table.context.user).id, table.context.api.auth.role, table.context.acl?.data]);
}

export function getWidthController(table: FlowModel): PersonalizationController {
  const shared = Reflect.get(table, 'personalization');
  if (shared instanceof PersonalizationController) return shared;
  let entry = tableControllers.get(table);
  if (!entry) {
    entry = { controller: new PersonalizationController(new TablePersonalizationApi(table.context.api)), headers: 0 };
    tableControllers.set(table, entry);
  }
  return entry.controller;
}

export function retainWidthHeader(table: FlowModel): () => void {
  const entry = tableControllers.get(table);
  if (!entry) return () => undefined;
  entry.headers++;
  return () => {
    if (--entry.headers === 0) entry.controller.stop();
  };
}

function parentTable(model: FlowModel): FlowModel | undefined {
  let parent = model.parent;
  const visited = new Set<string>();
  while (parent && !visited.has(parent.uid)) {
    visited.add(parent.uid);
    if (RESIZABLE_TABLE_MODELS.some((use) => use === parent?.use)) return parent;
    parent = parent.parent;
  }
}

export function installColumnWidth(model: FlowModel): void {
  const native = Reflect.get(model, 'getColumnProps');
  if (typeof native !== 'function') return;
  Reflect.set(model, 'getColumnProps', function (this: FlowModel, ...args: unknown[]) {
    const table = parentTable(model);
    const defaultWidth = Number(model.props.width);
    if (
      !table ||
      table.context.flowSettingsEnabled ||
      model.hidden ||
      model.forbidden ||
      !Number.isFinite(defaultWidth) ||
      defaultWidth <= 0
    ) {
      return Reflect.apply(native, this, args);
    }
    const controller = getWidthController(table);
    const identity = tableIdentity(table);
    const owner = tableOwner(table);
    const columnUid = logicalColumnUids.get(model) || model.uid;
    // Subscribe before header activation loads settings, including in native tables without a personalization toolbar.
    const personalWidth = controller.getWidth(columnUid, defaultWidth);
    const width = controller.matches(identity, owner) ? personalWidth : defaultWidth;
    let fork = widthForks.get(model);
    if (!fork) {
      // Native header/cell width calculations run on a local FlowEngine view, retaining the master's UID and settings.
      fork = model.createFork({ width }, undefined, { register: false });
      widthForks.set(model, fork);
    } else if (fork.props.width !== width) fork.setProps('width', width);
    const props = Reflect.apply(native, fork, args) as TableColumnProps | undefined;
    if (!props || props.hidden) return props;
    const title = props.title;
    const wrap = (children: React.ReactNode) => (
      <ColumnWidthHeader
        table={table}
        controller={controller}
        columnUid={columnUid}
        defaultWidth={defaultWidth}
        title={String(model.props.title || model.uid)}
      >
        {children}
      </ColumnWidthHeader>
    );
    return {
      ...props,
      title: typeof title === 'function' ? (context: Parameters<typeof title>[0]) => wrap(title(context)) : wrap(title),
    };
  });
}

export function withColumnWidth(Original: ModelConstructor): ModelConstructor {
  const Base = Original as unknown as typeof FlowModel;
  class PersonalColumnModel extends Base {
    onInit(options: Parameters<FlowModel['onInit']>[0]): void {
      super.onInit(options);
      installColumnWidth(this);
    }
  }
  Object.defineProperty(PersonalColumnModel, 'name', { value: Original.name });
  if (Base.meta) PersonalColumnModel.define(Base.meta);
  return PersonalColumnModel;
}
