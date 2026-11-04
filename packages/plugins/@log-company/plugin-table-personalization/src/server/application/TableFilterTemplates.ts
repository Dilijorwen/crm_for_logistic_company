/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { record } from '../../shared/contracts';
import type { FilterTemplateList, FilterTemplateOperation } from '../../shared/filterTemplates';
import { effectiveSettings, parseIdentity, parseSettings } from '../domain/ColumnPreferences';
import { restoreColumnSettings } from '../domain/RestoreColumnSettings';
import {
  invalidTemplate,
  parseRevision,
  parseSavedFilter,
  parseTemplateId,
  parseTemplateName,
} from '../domain/FilterTemplate';
import { FilterTemplateError } from '../domain/FilterTemplateError';
import { PersonalizationError } from '../domain/PersonalizationError';
import type { FilterTemplateConfiguration, FilterTemplateRepository } from './FilterTemplatePorts';

const INPUT_KEYS = {
  list: ['identity'],
  create: ['identity', 'name', 'filter', 'columnSettings', 'schemaSignature'],
  rename: ['identity', 'id', 'revision', 'name'],
  update: ['identity', 'id', 'revision', 'filter', 'columnSettings', 'schemaSignature'],
  delete: ['identity', 'id', 'revision'],
} as const;

export class TableFilterTemplates {
  constructor(
    private readonly configuration: FilterTemplateConfiguration,
    private readonly repository: FilterTemplateRepository,
    private readonly userId: string,
  ) {}

  async execute(operation: FilterTemplateOperation, input: unknown): Promise<FilterTemplateList> {
    const values = record(input);
    const keys: readonly string[] = INPUT_KEYS[operation];
    if (keys.some((key) => !(key in values)) || Object.keys(values).some((key) => !keys.includes(key)))
      invalidTemplate();
    const identity = parseIdentity(values.identity);
    const name = operation === 'create' || operation === 'rename' ? parseTemplateName(values.name) : undefined;
    const filter = operation === 'create' || operation === 'update' ? parseSavedFilter(values.filter) : undefined;
    const submittedColumns = filter ? parseSettings(values.columnSettings) : undefined;
    if (submittedColumns && (typeof values.schemaSignature !== 'string' || values.schemaSignature.length !== 64))
      invalidTemplate();
    const id = operation !== 'create' && operation !== 'list' ? parseTemplateId(values.id) : undefined;
    const revision = id ? parseRevision(values.revision) : undefined;
    const table = await this.configuration.authorize(identity);
    const resizable = table.resizableColumnUids || table.columns.map((column) => column.uid);
    if (submittedColumns && values.schemaSignature !== table.schemaSignature)
      throw new PersonalizationError('SCHEMA_CHANGED');
    if (filter && !(await this.configuration.canUseFilter(identity, filter)))
      throw new FilterTemplateError('FORBIDDEN');
    const columns = submittedColumns
      ? restoreColumnSettings(submittedColumns, null, table.columns, table.existingColumnUids, resizable)
      : undefined;
    if (operation === 'create' && name && filter && columns) {
      await this.repository.create({
        userId: this.userId,
        instanceKey: table.instanceKey,
        instanceRootUid: table.instanceRootUid,
        tableUid: table.tableUid,
        name,
        filter,
        columnSettings: columns,
        revision: 1,
      });
    } else if (id) {
      await this.repository.change(table.instanceKey, this.userId, id, (template) => {
        if (template.userId !== this.userId) throw new FilterTemplateError('FORBIDDEN');
        if (template.revision !== revision) throw new FilterTemplateError('CONFLICT');
        if (operation === 'delete') return null;
        return {
          ...template,
          ...(name ? { name } : {}),
          ...(filter ? { filter } : {}),
          ...(submittedColumns
            ? {
                columnSettings: restoreColumnSettings(
                  submittedColumns,
                  template.columnSettings,
                  table.columns,
                  table.existingColumnUids,
                  resizable,
                ),
              }
            : {}),
          revision: template.revision + 1,
        };
      });
    }
    const templates = [];
    for (const template of await this.repository.list(table.instanceKey, this.userId)) {
      if (!(await this.configuration.canUseFilter(identity, template.filter))) continue;
      const columnSettings = effectiveSettings(template.columnSettings, table.columns, resizable);
      if (!columnSettings) throw new FilterTemplateError('INVALID_TEMPLATE');
      templates.push({
        id: template.id,
        name: template.name,
        filter: template.filter,
        columnSettings,
        revision: template.revision,
      });
    }
    return { templates, schemaSignature: table.schemaSignature };
  }
}
