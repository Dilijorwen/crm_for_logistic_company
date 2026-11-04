/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useState } from 'react';
import { Button, Popover } from 'antd';
import { observer } from '@nocobase/flow-engine';
import type { TableTemplateHost } from '../model/TableTemplateHost';
import { FilterTemplatesToolbar } from './FilterTemplatesToolbar';

export const TableTemplatesButton = observer(({ model }: { model: TableTemplateHost }) => {
  const [isOpen, setOpen] = useState(false);
  const state = model.templates.state;
  return (
    <Popover
      open={isOpen}
      trigger="click"
      placement="bottomLeft"
      onOpenChange={(open) => {
        if (!state.isSaving && !state.isApplying) setOpen(open);
      }}
      content={<FilterTemplatesToolbar model={model} isOpen={isOpen} />}
    >
      <Button aria-label="Шаблоны" disabled={model.isTemplateOperationBlocked()}>
        Шаблоны
      </Button>
    </Popover>
  );
});
