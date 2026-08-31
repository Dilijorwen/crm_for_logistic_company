/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type RegistryErrorCode =
  | 'REGISTRY_NOT_CONFIGURED'
  | 'REGISTRY_AUTHENTICATION_FAILED'
  | 'REGISTRY_TEMPORARY_UNAVAILABLE'
  | 'INVALID_REGISTRY_RESPONSE'
  | 'TECHNICAL_REGULATION_CONFLICT';

export class RegistryError extends Error {
  constructor(
    readonly code: RegistryErrorCode,
    message: string,
    readonly isTemporary: boolean,
  ) {
    super(message);
    this.name = 'RegistryError';
  }
}
