/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useEffect, useState } from 'react';
import type { WorkspaceViewHost } from '../../../shared/lib';

/** Use the same FlowEngine ACL as native actions, including data-source and field permissions. */
export function useWorkspaceRunPermissions(host: WorkspaceViewHost, runId: string) {
  const [state, setState] = useState({ loading: true, canCreate: false, canAssociate: false });
  useEffect(() => {
    let active = true;
    setState({ loading: true, canCreate: false, canAssociate: false });
    async function load() {
      try {
        const [create, associate] = await Promise.all([
          host.context.aclCheck({ dataSourceKey: 'main', resourceName: 'shipments', actionName: 'create' }),
          host.context.aclCheck({
            dataSourceKey: 'main',
            resourceName: 'transport_runs',
            actionName: 'update',
            fields: ['shipments'],
            recordPkValue: runId,
          }),
        ]);
        if (active) setState({ loading: false, canCreate: Boolean(create), canAssociate: Boolean(associate) });
      } catch (error) {
        console.error('Не удалось проверить права действий рейса.', error);
        if (active) setState({ loading: false, canCreate: false, canAssociate: false });
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [host, runId]);
  return state;
}
