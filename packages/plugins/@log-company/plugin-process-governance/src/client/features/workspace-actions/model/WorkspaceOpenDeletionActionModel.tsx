/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DeleteOutlined } from '@ant-design/icons';
import { ActionModel, ActionSceneEnum, useACLRoleContext } from '@nocobase/client';
import { Button, Tooltip } from 'antd';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { WORKSPACE_DELETION_PATH } from '../../../../shared/workspace';
import { isWorkspaceContext } from '../../../shared/lib';

export function useWorkspaceDeletionPermissions() {
  const { allowAll, parseAction } = useACLRoleContext();
  const can = (path: string, id?: string) =>
    Boolean(allowAll || parseAction(path, { ignoreScope: !id, recordPkValue: id }));
  return {
    canReadRuns: can('transport_runs:list'),
    canReadShipments: can('shipments:list'),
    canOpen: can('transport_runs:destroy') || can('shipments:destroy'),
    canDeleteRun: (id: string) => can('transport_runs:destroy', id),
    canDeleteShipment: (id: string) => can('shipments:destroy', id),
  };
}

function WorkspaceOpenDeletionButton({ permitted, disabled }: { permitted?: boolean; disabled?: boolean }) {
  const navigate = useNavigate();
  if (!permitted) return null;
  return (
    <Tooltip title="Удалить">
      <Button
        danger
        disabled={disabled}
        icon={<DeleteOutlined aria-hidden />}
        aria-label="Удалить рейсы и поставки"
        onClick={() => navigate(WORKSPACE_DELETION_PATH)}
      />
    </Tooltip>
  );
}

export class LogisticsWorkspaceOpenDeletionActionModel extends ActionModel {
  declare props: ActionModel['props'] & { canOpenDeletion?: boolean };
  static scene = ActionSceneEnum.collection;

  render() {
    return <WorkspaceOpenDeletionButton permitted={this.props.canOpenDeletion} disabled={this.props.disabled} />;
  }
}

LogisticsWorkspaceOpenDeletionActionModel.define({
  label: 'Удалить рейсы и поставки',
  hide: (context) => !isWorkspaceContext(context),
});

LogisticsWorkspaceOpenDeletionActionModel.registerFlow({
  key: 'buttonAclSettings',
  steps: {
    aclCheck: {
      async handler(ctx) {
        const [canDeleteRun, canDeleteShipment] = await Promise.all([
          ctx.aclCheck({ dataSourceKey: 'main', resourceName: 'transport_runs', actionName: 'destroy' }),
          ctx.aclCheck({ dataSourceKey: 'main', resourceName: 'shipments', actionName: 'destroy' }),
        ]);
        ctx.model.setProps({ canOpenDeletion: Boolean(canDeleteRun || canDeleteShipment) });
      },
    },
  },
});
