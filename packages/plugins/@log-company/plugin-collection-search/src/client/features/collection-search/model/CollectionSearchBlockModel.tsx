/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { BlockModel } from '@nocobase/client';
import { tExpr } from '@nocobase/flow-engine';
import React from 'react';
import { NAMESPACE } from '../../../locale';
import { CollectionSearchPanel } from '../ui/CollectionSearchPanel';

export class CollectionSearchBlockModel extends BlockModel {
  renderComponent() {
    return <CollectionSearchPanel collection={this.context.collection} model={this} />;
  }
}

CollectionSearchBlockModel.define({
  label: tExpr('block.title', { ns: NAMESPACE }),
  sort: 548,
});
