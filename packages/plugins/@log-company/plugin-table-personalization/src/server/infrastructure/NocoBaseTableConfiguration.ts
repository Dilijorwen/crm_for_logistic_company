/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createHash } from 'node:crypto';
import type { Context } from '@nocobase/actions';
import type { Model } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import type { PersonalizableColumn, TableIdentity } from '../../shared/contracts';
import { fixedGroup, record, RESIZABLE_TABLE_MODELS, RESIZABLE_COLUMN_MODELS } from '../../shared/contracts';
import type { AuthorizedTable, TableConfigurationGateway } from '../application/ports';
import { PersonalizationError } from '../domain/PersonalizationError';
import { MAX_COLUMNS } from '../domain/ColumnPreferences';

interface SavedModel {
  uid: string;
  options: Record<string, unknown>;
}

function step(model: SavedModel, flow: string, key: string): Record<string, unknown> {
  return record(record(record(model.options.stepParams)[flow])[key]);
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function pathAllowed(params: Record<string, unknown>, path: string): boolean {
  if (
    Array.isArray(params.except) &&
    params.except.some((name) => typeof name === 'string' && (name === path || path.startsWith(`${name}.`)))
  )
    return false;
  if (!Array.isArray(params.fields) && !Array.isArray(params.appends)) return true;
  const allowed = [
    ...(Array.isArray(params.fields) ? params.fields : []),
    ...(Array.isArray(params.appends) ? params.appends : []),
  ];
  return allowed.some((name) => typeof name === 'string' && (name === path || path.startsWith(`${name}.`)));
}

export class NocoBaseTableConfiguration implements TableConfigurationGateway {
  private readonly roles: string[];

  constructor(
    private readonly plugin: Plugin,
    private readonly context: Context,
  ) {
    this.roles = Array.isArray(context.state.currentRoles)
      ? context.state.currentRoles.filter((role: unknown): role is string => typeof role === 'string')
      : [context.state.currentRole || 'anonymous'];
  }

  async authorize(identity: TableIdentity): Promise<AuthorizedTable> {
    const table = await this.findModel(identity.tableUid);
    if (!RESIZABLE_TABLE_MODELS.some((use) => use === table.options.use)) throw new PersonalizationError('NOT_FOUND');
    const path = await this.resolveInstancePath(identity);
    const instanceRootUid = identity.referencePath[0] || table.uid;
    await this.authorizeRoute(instanceRootUid);
    const resource = await this.tableResource(table);
    const dataSourceKey = typeof resource.dataSourceKey === 'string' ? resource.dataSourceKey : 'main';
    const collectionName = resource.collectionName;
    if (typeof collectionName !== 'string') throw new PersonalizationError('NOT_FOUND');
    const dataSource = this.plugin.app.dataSourceManager.get(dataSourceKey);
    const collection = dataSource?.collectionManager.getCollection(collectionName);
    if (!dataSource || !collection) throw new PersonalizationError('NOT_FOUND');
    this.readPermission(dataSourceKey, collectionName);
    if (typeof resource.associationName === 'string') {
      const [sourceName, associationName] = resource.associationName.split('.');
      const sourceCollection = dataSource.collectionManager.getCollection(sourceName);
      const association = sourceCollection?.getField(associationName);
      if (association?.options.target !== collectionName) throw new PersonalizationError('FORBIDDEN');
      if (!this.canReadField(dataSourceKey, sourceName, associationName)) throw new PersonalizationError('FORBIDDEN');
    }
    const children: Model[] = await this.plugin.db.getRepository('flowModels').find({
      filter: {
        'options.parentId': table.uid,
        'options.subKey': table.options.use === 'PopupSubTableFieldModel' ? 'subTableColumns' : 'columns',
      },
      fields: ['uid', 'options'],
    });
    const columns: PersonalizableColumn[] = [];
    const existingColumnUids: string[] = [];
    const resizableColumnUids: string[] = [];
    const structuralColumns: unknown[] = [];
    const configuredPaths = new Set<string>();
    for (const child of children) {
      const model: SavedModel = { uid: String(child.get('uid')), options: record(child.get('options')) };
      structuralColumns.push([model.uid, model.options]);
      if (!RESIZABLE_COLUMN_MODELS.some((use) => use === model.options.use)) continue;
      existingColumnUids.push(model.uid);
      if (model.options.use !== 'TableColumnModel' && model.options.use !== 'SubTableColumnModel') {
        resizableColumnUids.push(model.uid);
        continue;
      }
      const binding = step(model, 'fieldSettings', 'init');
      if (typeof binding.collectionName !== 'string' || (binding.dataSourceKey || 'main') !== dataSourceKey) continue;
      const isCollectionTable = ['TableBlockModel', 'TableSelectModel'].includes(String(table.options.use));
      if (isCollectionTable && binding.collectionName !== collectionName) continue;
      if (typeof binding.fieldPath !== 'string') continue;
      configuredPaths.add(binding.fieldPath);
      if (!this.canReadPath(dataSourceKey, binding.collectionName, binding.fieldPath, model)) continue;
      resizableColumnUids.push(model.uid);
      const field = dataSource.collectionManager
        .getCollection(binding.collectionName)
        ?.getField(binding.fieldPath.split('.')[0]);
      const configuredTitle = step(model, 'tableColumnSettings', 'title').title;
      const title = configuredTitle || record(field.options.uiSchema).title || field.options.name;
      columns.push({
        uid: model.uid,
        title: typeof title === 'string' ? title : binding.fieldPath,
        fieldPath: binding.fieldPath,
        fixed: fixedGroup(step(model, 'tableColumnSettings', 'fixed').fixed || record(model.options.props).fixed),
      });
    }
    const sortIndexes = new Map(
      children.map((child) => [String(child.get('uid')), Number(record(child.get('options')).sortIndex) || 0]),
    );
    columns.sort((left, right) => (sortIndexes.get(left.uid) || 0) - (sortIndexes.get(right.uid) || 0));
    const collectionFields: unknown[] = [];
    for (const field of ['TableBlockModel', 'TableSelectModel'].includes(String(table.options.use))
      ? collection.getFields()
      : []) {
      const name = field.options.name;
      if (typeof name !== 'string') continue;
      collectionFields.push([name, field.options]);
      if (configuredPaths.has(name)) continue;
      const uid = `lc_field_${hash([dataSourceKey, collectionName, name])}`;
      existingColumnUids.push(uid);
      if (!this.canReadPath(dataSourceKey, collectionName, name)) continue;
      resizableColumnUids.push(uid);
      const title = record(field.options.uiSchema).title || name;
      columns.push({
        uid,
        title: typeof title === 'string' ? title : name,
        fieldPath: name,
        fixed: 'normal',
        source: 'collection',
      });
    }
    if (existingColumnUids.length > MAX_COLUMNS) throw new PersonalizationError('INVALID_SETTINGS');
    collectionFields.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    structuralColumns.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    return {
      tableUid: table.uid,
      instanceRootUid,
      instanceKey: hash(path),
      schemaSignature: hash([path, resource, structuralColumns, collectionFields, columns]),
      columns,
      existingColumnUids,
      resizableColumnUids,
    };
  }

  private async tableResource(table: SavedModel): Promise<Record<string, unknown>> {
    if (['TableBlockModel', 'TableSelectModel'].includes(String(table.options.use)))
      return step(table, 'resourceSettings', 'init');
    let current = table;
    const visited = new Set<string>();
    while (!visited.has(current.uid) && visited.size < 20) {
      visited.add(current.uid);
      const binding = step(current, 'fieldSettings', 'init');
      if (typeof binding.collectionName === 'string' && typeof binding.fieldPath === 'string') {
        const dataSourceKey = typeof binding.dataSourceKey === 'string' ? binding.dataSourceKey : 'main';
        const dataSource = this.plugin.app.dataSourceManager.get(dataSourceKey);
        let collectionName = binding.collectionName;
        for (const name of binding.fieldPath.split('.')) {
          if (!this.canReadField(dataSourceKey, collectionName, name)) throw new PersonalizationError('FORBIDDEN');
          const target = dataSource?.collectionManager.getCollection(collectionName)?.getField(name)?.options.target;
          if (typeof target !== 'string') throw new PersonalizationError('NOT_FOUND');
          collectionName = target;
        }
        return { ...binding, dataSourceKey, collectionName };
      }
      if (typeof current.options.parentId !== 'string') break;
      current = await this.findModel(current.options.parentId);
    }
    throw new PersonalizationError('NOT_FOUND');
  }

  private readPermission(dataSourceKey: string, collectionName: string): Record<string, unknown> {
    const dataSource = this.plugin.app.dataSourceManager.get(dataSourceKey);
    const permission = dataSource?.acl.can({ roles: this.roles, resource: collectionName, action: 'list' });
    if (!permission) throw new PersonalizationError('FORBIDDEN');
    return record(permission.params);
  }

  private canReadField(dataSourceKey: string, collectionName: string, name: string): boolean {
    const field = this.plugin.app.dataSourceManager
      .get(dataSourceKey)
      ?.collectionManager.getCollection(collectionName)
      ?.getField(name);
    // NocoBase omits hidden collection fields from JSON even when the role allows reading them.
    if (!field || field.options.hidden) return false;
    try {
      const params = this.readPermission(dataSourceKey, collectionName);
      const fields = params.fields;
      const appends = params.appends;
      const except = params.except;
      if (Array.isArray(except) && except.includes(name)) return false;
      if (!Array.isArray(fields) && !Array.isArray(appends)) return true;
      return [...(Array.isArray(fields) ? fields : []), ...(Array.isArray(appends) ? appends : [])].some(
        (field) => typeof field === 'string' && field.split('.')[0] === name,
      );
    } catch (error) {
      if (error instanceof PersonalizationError && error.code === 'FORBIDDEN') return false;
      throw error;
    }
  }

  private canReadPath(dataSourceKey: string, collectionName: string, path: string, model?: SavedModel): boolean {
    const dataSource = this.plugin.app.dataSourceManager.get(dataSourceKey);
    let currentCollection = collectionName;
    const names = path.split('.');
    for (let index = 0; index < names.length; index++) {
      const field = dataSource?.collectionManager.getCollection(currentCollection)?.getField(names[index]);
      if (!field || !this.canReadField(dataSourceKey, currentCollection, names[index])) return false;
      const target = field.options.target;
      let remainingPath = names.slice(index).join('.');
      if (index === names.length - 1 && typeof target === 'string') {
        const targetCollection = dataSource?.collectionManager.getCollection(target);
        const label =
          (model && step(model, 'tableColumnSettings', 'fieldNames').label) ||
          targetCollection?.options.titleField ||
          'id';
        if (typeof label !== 'string') return false;
        remainingPath = `${remainingPath}.${label}`;
      }
      if (!pathAllowed(this.readPermission(dataSourceKey, currentCollection), remainingPath)) return false;
      if (index < names.length - 1) {
        if (typeof target !== 'string') return false;
        currentCollection = target;
      } else if (typeof target === 'string') {
        const targetCollection = dataSource?.collectionManager.getCollection(target);
        const label =
          (model && step(model, 'tableColumnSettings', 'fieldNames').label) ||
          targetCollection?.options.titleField ||
          'id';
        return typeof label === 'string' && this.canReadField(dataSourceKey, target, label);
      }
    }
    return true;
  }

  private async findModel(uid: string): Promise<SavedModel> {
    const model = await this.plugin.db
      .getRepository('flowModels')
      .findOne({ filterByTk: uid, fields: ['uid', 'options'] });
    if (!model) throw new PersonalizationError('NOT_FOUND');
    return { uid: String(model.get('uid')), options: record(model.get('options')) };
  }

  private async ancestors(uid: string): Promise<string[]> {
    const paths: Model[] = await this.plugin.db
      .getRepository('flowModelTreePath')
      .find({ filter: { descendant: uid }, fields: ['ancestor'] });
    return [uid, ...paths.map((path) => String(path.get('ancestor')))];
  }

  private async resolveInstancePath(identity: TableIdentity): Promise<string[]> {
    const canonical: string[] = [];
    for (let index = 0; index < identity.referencePath.length; index++) {
      let current = await this.findModel(identity.referencePath[index]);
      const destination = identity.referencePath[index + 1] || identity.tableUid;
      const visited = new Set<string>();
      while (current.options.use === 'ReferenceBlockModel') {
        if (visited.has(current.uid) || visited.size >= 20) throw new PersonalizationError('FORBIDDEN');
        visited.add(current.uid);
        canonical.push(current.uid);
        const targetUid = step(current, 'referenceSettings', 'target').targetUid;
        if (typeof targetUid !== 'string') throw new PersonalizationError('NOT_FOUND');
        current = await this.findModel(targetUid);
      }
      if (!visited.size || !(await this.ancestors(destination)).includes(current.uid)) {
        throw new PersonalizationError('FORBIDDEN');
      }
      canonical.push(current.uid);
    }
    if (canonical[canonical.length - 1] !== identity.tableUid) canonical.push(identity.tableUid);
    return canonical;
  }

  private async authorizeRoute(uid: string): Promise<void> {
    const ancestors = await this.ancestors(uid);
    const routes: Model[] = await this.plugin.db.getRepository('desktopRoutes').find({
      filter: { 'schemaUid.$in': ancestors },
      fields: ['id', 'parentId'],
    });
    if (!routes.length) throw new PersonalizationError('FORBIDDEN');
    if (this.roles.includes('root')) return;
    const roles = await this.plugin.db
      .getRepository('roles')
      .find({ filterByTk: this.roles, appends: ['desktopRoutes'] });
    const accessible = new Set<string>();
    for (const role of roles) {
      const roleRoutes: unknown = role.get('desktopRoutes');
      if (Array.isArray(roleRoutes)) {
        for (const route of roleRoutes) accessible.add(String(record(record(route).dataValues).id || record(route).id));
      }
    }
    if (!routes.some((route) => accessible.has(String(route.get('id'))))) throw new PersonalizationError('FORBIDDEN');
  }
}
