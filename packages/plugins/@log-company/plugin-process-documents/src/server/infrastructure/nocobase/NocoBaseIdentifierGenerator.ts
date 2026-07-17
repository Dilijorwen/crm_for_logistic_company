import type { Plugin } from '@nocobase/server';
import type { IdentifierGenerator } from '../../application/ports/DocumentStorage';

interface SnowflakeIdGenerator {
  generate(): string | number | bigint;
}

export class NocoBaseIdentifierGenerator implements IdentifierGenerator {
  constructor(private readonly plugin: Plugin) {}

  generate(): string {
    const application = this.plugin.app as typeof this.plugin.app & { snowflakeIdGenerator: SnowflakeIdGenerator };
    return String(application.snowflakeIdGenerator.generate());
  }
}
