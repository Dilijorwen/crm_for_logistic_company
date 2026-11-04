/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { FlowRoute, useCurrentRoute, useKeepAlive } from '@nocobase/client';
import { observer, useFlowEngine } from '@nocobase/flow-engine';
import { Skeleton } from 'antd';
import React, { useRef } from 'react';

/** NocoBase 2.0.60 captures the global route UID on mount. A late inactive
 * KeepAlive child must first become its own active route before that happens. */
export const StableFlowRoute = observer(() => {
  const currentRoute = useCurrentRoute();
  const { active } = useKeepAlive();
  const engine = useFlowEngine();
  const initialized = useRef(false);
  if (active && currentRoute.schemaUid && currentRoute.schemaUid === engine.context.route.params?.name)
    initialized.current = true;

  // Once initialized, preserve the native route and its cached page on deactivation.
  if (initialized.current) return <FlowRoute />;
  return active ? <Skeleton active /> : null;
});
