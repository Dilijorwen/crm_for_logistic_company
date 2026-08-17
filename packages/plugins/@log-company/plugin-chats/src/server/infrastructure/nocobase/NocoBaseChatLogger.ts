/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import type { ChatLogger } from '../../application/ports/ChatLogger';

export class NocoBaseChatLogger implements ChatLogger {
  constructor(private readonly plugin: Plugin) {}

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.plugin.app.logger.warn(message, metadata);
  }

  error(message: string, error: unknown, metadata?: Record<string, unknown>): void {
    this.plugin.app.logger.error(message, { ...metadata, error: String(error) });
  }
}
