/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useACLRoleContext } from '@nocobase/client';
import { useCallback } from 'react';

export interface LogisticsPermissions {
  canViewRuns: boolean;
  canCreateRun: boolean;
  canUpdateRun: (runId: string) => boolean;
  canDeleteRun: (runId: string) => boolean;
  canCreateShipment: boolean;
  canUpdateShipment: (shipmentId: string) => boolean;
}

export function useLogisticsPermissions(): LogisticsPermissions {
  const { allowAll, parseAction } = useACLRoleContext();
  const hasAction = useCallback(
    (path: string, recordId?: string): boolean =>
      Boolean(allowAll || parseAction(path, { ignoreScope: !recordId, recordPkValue: recordId })),
    [allowAll, parseAction],
  );
  return {
    canViewRuns: hasAction('transport_runs:list'),
    canCreateRun: hasAction('transport_runs:create'),
    canUpdateRun: (runId) => hasAction('transport_runs:update', runId),
    canDeleteRun: (runId) => hasAction('transport_runs:destroy', runId),
    canCreateShipment: hasAction('shipments:create'),
    canUpdateShipment: (shipmentId) => hasAction('shipments:update', shipmentId),
  };
}
