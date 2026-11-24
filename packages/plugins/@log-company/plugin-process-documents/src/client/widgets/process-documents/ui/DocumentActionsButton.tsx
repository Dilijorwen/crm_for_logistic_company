/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { EllipsisOutlined } from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';

export function DocumentActionsButton({ menu, label }: { menu: MenuProps; label: string }) {
  return (
    <Dropdown menu={menu} trigger={['click']}>
      <Button size="small" type="text" aria-label={label} aria-haspopup="menu" icon={<EllipsisOutlined />} />
    </Dropdown>
  );
}
