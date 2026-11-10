/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';
import type {
  FilterTemplateInput,
  FilterTemplateList,
  FilterTemplateOperation,
} from '../../../../shared/filterTemplates';

export interface FilterTemplateApi {
  request(operation: FilterTemplateOperation, input: FilterTemplateInput): Promise<FilterTemplateList>;
}

export class TableFilterTemplateApi implements FilterTemplateApi {
  constructor(private readonly api: Pick<APIClient, 'request'>) {}

  async request(operation: FilterTemplateOperation, input: FilterTemplateInput): Promise<FilterTemplateList> {
    const response = await this.api.request<{ data: FilterTemplateList }>({
      url: `tableFilterTemplates:${operation}`,
      method: 'post',
      ...(operation === 'update' ? { params: { filterByTk: input.id } } : {}),
      data: input,
      skipNotify: true,
    });
    return response.data.data;
  }
}
