/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import type { SyncClock, SyncLogger } from '../../application/ports/PermitDocumentSyncSupport';

export class SystemSyncClock implements SyncClock {
  now(): Date {
    return new Date();
  }
}

export class NocoBaseSyncLogger implements SyncLogger {
  constructor(private readonly plugin: Plugin) {}

  info(message: string, context?: Record<string, unknown>): void {
    this.plugin.app.logger.info(`[permit-documents] ${message}`, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.plugin.app.logger.warn(`[permit-documents] ${message}`, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.plugin.app.logger.error(`[permit-documents] ${message}`, context);
  }
}
