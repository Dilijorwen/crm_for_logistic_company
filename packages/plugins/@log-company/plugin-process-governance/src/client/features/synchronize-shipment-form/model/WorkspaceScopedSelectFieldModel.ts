/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { RecordSelectFieldModel } from '@nocobase/client';

export class LogisticsWorkspaceScopedSelectFieldModel extends RecordSelectFieldModel {
  getDataSource(): unknown[] | undefined {
    const options: unknown[] | undefined = super.getDataSource();
    // NocoBase 2.0.60 reads the first record when both the count and cached option length are zero.
    return options?.length ? options : undefined;
  }
}
