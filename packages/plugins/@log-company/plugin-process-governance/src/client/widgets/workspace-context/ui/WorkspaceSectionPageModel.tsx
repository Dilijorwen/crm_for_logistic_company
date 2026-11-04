/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ChildPageModel } from '@nocobase/client';
import React from 'react';

/** Native section tabs without a second back button or duplicate page heading. */
export class LogisticsWorkspaceSectionPageModel extends ChildPageModel {
  tabBarExtraContent = { left: <></> };
}
