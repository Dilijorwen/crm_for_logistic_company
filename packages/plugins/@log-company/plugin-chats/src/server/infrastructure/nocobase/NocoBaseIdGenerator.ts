/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import type { IdGenerator } from '../../application/ports/IdGenerator';

interface SnowflakeIdGenerator {
  generate(): string | number | bigint;
}

export class NocoBaseIdGenerator implements IdGenerator {
  constructor(private readonly plugin: Plugin) {}

  generate(): string {
    const application = this.plugin.app as typeof this.plugin.app & { snowflakeIdGenerator: SnowflakeIdGenerator };
    return String(application.snowflakeIdGenerator.generate());
  }
}
