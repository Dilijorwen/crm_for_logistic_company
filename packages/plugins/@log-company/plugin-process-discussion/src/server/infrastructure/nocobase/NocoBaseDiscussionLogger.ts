/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import type { DiscussionLogger } from '../../application/ports/DiscussionLogger';

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { error: error.message, stack: error.stack };
  }
  return { error: String(error) };
}

export class NocoBaseDiscussionLogger implements DiscussionLogger {
  constructor(private readonly plugin: Plugin) {}

  error(message: string, error: unknown, metadata?: Record<string, unknown>): void {
    this.plugin.app.logger.error(`[process-discussion] ${message}`, {
      ...metadata,
      ...describeError(error),
    });
  }
}
