/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { LogisticsWorkspaceNewRunActionModel } from '../model/WorkspaceActionModels';
import { isWorkspaceContext } from '../../../shared/lib';

/** The main work list creates runs; shipments are created inside a run. */
export class LogisticsWorkspaceAddActionModel extends LogisticsWorkspaceNewRunActionModel {}
LogisticsWorkspaceAddActionModel.define({ label: 'Добавить рейс', hide: (ctx) => !isWorkspaceContext(ctx) });
