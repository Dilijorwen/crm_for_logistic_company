/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type FilterTemplateErrorCode = 'INVALID_TEMPLATE' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'DUPLICATE_NAME';

export class FilterTemplateError extends Error {
  constructor(public readonly code: FilterTemplateErrorCode) {
    super(code);
    this.name = 'FilterTemplateError';
  }
}
