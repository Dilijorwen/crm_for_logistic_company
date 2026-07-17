import type { Plugin } from '@nocobase/server';
import type { GovernanceLogger } from '../../application/ports/ProcessGovernanceRepository';

export class NocoBaseGovernanceLogger implements GovernanceLogger {
  constructor(private readonly plugin: Plugin) {}

  warn(message: string, metadata?: Record<string, unknown>): void {
    const logger = this.plugin.app.log || this.plugin.app.logger;
    logger.warn?.(`[process-governance] ${message}`, metadata);
  }

  error(message: string, error: unknown, metadata?: Record<string, unknown>): void {
    const logger = this.plugin.app.log || this.plugin.app.logger;
    const errorDetails =
      error instanceof Error ? { error: error.message, stack: error.stack } : { error: String(error) };
    logger.error?.(`[process-governance] ${message}`, { ...metadata, ...errorDetails });
  }
}
