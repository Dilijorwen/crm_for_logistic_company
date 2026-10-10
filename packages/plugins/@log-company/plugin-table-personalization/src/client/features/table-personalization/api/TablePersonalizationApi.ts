/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';
import type { ColumnSettings, TableIdentity, TablePersonalization } from '../../../../shared/contracts';

export interface PersonalizationApi {
  get(identity: TableIdentity): Promise<TablePersonalization>;
  save(identity: TableIdentity, settings: ColumnSettings, schemaSignature: string): Promise<TablePersonalization>;
  reset(identity: TableIdentity): Promise<TablePersonalization>;
  width(
    identity: TableIdentity,
    columnUid: string,
    width: number | null,
    schemaSignature: string,
  ): Promise<TablePersonalization>;
}

export class TablePersonalizationApi implements PersonalizationApi {
  constructor(private readonly api: Pick<APIClient, 'request'>) {}

  private async request(
    operation: 'get' | 'save' | 'reset' | 'width',
    values: {
      identity: TableIdentity;
      settings?: ColumnSettings;
      schemaSignature?: string;
      columnUid?: string;
      width?: number | null;
    },
  ): Promise<TablePersonalization> {
    const response = await this.api.request<{ data: TablePersonalization }>({
      url: `tablePersonalizations:${operation}`,
      method: 'post',
      data: values,
      skipNotify: true,
    });
    return response.data.data;
  }

  get(identity: TableIdentity): Promise<TablePersonalization> {
    return this.request('get', { identity });
  }

  save(identity: TableIdentity, settings: ColumnSettings, schemaSignature: string): Promise<TablePersonalization> {
    // An open layout dialog must not overwrite widths changed later in another header or tab.
    const { version, columnOrder, hiddenColumnUids } = settings;
    return this.request('save', { identity, settings: { version, columnOrder, hiddenColumnUids }, schemaSignature });
  }

  reset(identity: TableIdentity): Promise<TablePersonalization> {
    return this.request('reset', { identity });
  }

  width(
    identity: TableIdentity,
    columnUid: string,
    width: number | null,
    schemaSignature: string,
  ): Promise<TablePersonalization> {
    return this.request('width', { identity, columnUid, width, schemaSignature });
  }
}
