/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { TablePersonalization } from '../../shared/contracts';
import {
  effectiveSettings,
  mergeSettings,
  parseIdentity,
  parseSettings,
  parseWidthChange,
} from '../domain/ColumnPreferences';
import { PersonalizationError } from '../domain/PersonalizationError';
import type { PersonalizationRepository, PreferenceOwner, TableConfigurationGateway } from './ports';

export class TablePersonalizations {
  constructor(
    private readonly configuration: TableConfigurationGateway,
    private readonly repository: PersonalizationRepository,
    private readonly userId: string,
  ) {}

  async execute(
    operation: 'get' | 'save' | 'reset' | 'width',
    input: {
      identity: unknown;
      settings?: unknown;
      schemaSignature?: unknown;
      columnUid?: unknown;
      width?: unknown;
    },
  ): Promise<TablePersonalization> {
    const identity = parseIdentity(input.identity);
    const submitted = operation === 'save' ? parseSettings(input.settings) : null;
    const change = operation === 'width' ? parseWidthChange(input.columnUid, input.width) : null;
    if (
      (operation === 'save' || change) &&
      (typeof input.schemaSignature !== 'string' || input.schemaSignature.length !== 64)
    ) {
      throw new PersonalizationError('INVALID_SETTINGS');
    }
    const table = await this.configuration.authorize(identity);
    const resizableColumnUids = table.resizableColumnUids || table.columns.map((column) => column.uid);
    const metadata = {
      columns: table.columns,
      schemaSignature: table.schemaSignature,
      ...(table.resizableColumnUids ? { resizableColumnUids } : {}),
    };
    const owner: PreferenceOwner = {
      userId: this.userId,
      instanceKey: table.instanceKey,
      instanceRootUid: table.instanceRootUid,
      tableUid: table.tableUid,
    };
    if (operation === 'reset') {
      await this.repository.reset(owner);
      return { ...metadata, settings: null };
    }
    const previous = await this.repository.find(owner);
    let settings = previous;
    if (submitted || change) {
      if (input.schemaSignature !== table.schemaSignature) throw new PersonalizationError('SCHEMA_CHANGED');
      if (change && !resizableColumnUids.includes(change.columnUid)) throw new PersonalizationError('FORBIDDEN');
      settings = await this.repository.update(owner, (current) => {
        if (submitted)
          return mergeSettings(submitted, current, table.columns, table.existingColumnUids, resizableColumnUids);
        const baseline = current || {
          version: 1 as const,
          columnOrder: table.columns.map((column) => column.uid),
          hiddenColumnUids: table.columns
            .filter((column) => column.source === 'collection')
            .map((column) => column.uid),
        };
        const widths = Object.fromEntries(
          Object.entries(baseline.columnWidths || {}).filter(([uid]) => table.existingColumnUids.includes(uid)),
        );
        if (change?.width === null) delete widths[change.columnUid];
        else if (change) widths[change.columnUid] = change.width;
        return { ...baseline, columnWidths: widths };
      });
    }
    return {
      ...metadata,
      settings: effectiveSettings(settings, table.columns, resizableColumnUids),
    };
  }
}
