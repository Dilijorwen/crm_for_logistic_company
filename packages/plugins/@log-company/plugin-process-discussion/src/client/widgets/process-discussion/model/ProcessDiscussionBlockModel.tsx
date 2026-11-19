/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { BlockModel } from '@nocobase/client';
import React from 'react';
import { getProcessBlockModelContext } from '@log-company/plugin-process-governance/client';
import { ProcessDiscussionBlock } from '../ui/ProcessDiscussionBlock';

export class ProcessDiscussionBlockModel extends BlockModel {
  renderComponent() {
    return <ProcessDiscussionBlock modelContext={getProcessBlockModelContext(this, this.context)} />;
  }
}

ProcessDiscussionBlockModel.define({
  label: 'Обсуждение поставки',
  sort: 545,
});
