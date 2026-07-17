import type { Plugin } from '@nocobase/server';
import type { ApplicationLogger } from '../../application/ports/DocumentStorage';

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { error: error.message, stack: error.stack };
  }
  return { error: String(error) };
}

export class NocoBaseApplicationLogger implements ApplicationLogger {
  constructor(private readonly plugin: Plugin) {}

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.plugin.app.logger.warn(`[process-documents] ${message}`, metadata);
  }

  error(message: string, error: unknown, metadata?: Record<string, unknown>): void {
    this.plugin.app.logger.error(`[process-documents] ${message}`, {
      ...metadata,
      ...describeError(error),
    });
  }
}
