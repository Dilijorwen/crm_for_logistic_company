/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  AssociateActionModel,
  DisassociateActionModel,
  getAssociationSelectorContextInputArgs,
  getAssociationTargetResourceSettings,
} from '@nocobase/client';
import { FlowModelRenderer, type FlowModel } from '@nocobase/flow-engine';
import { DownOutlined, DisconnectOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Dropdown, Tooltip } from 'antd';
import React from 'react';
import { LogisticsWorkspaceNewShipmentActionModel } from '../model/WorkspaceActionModels';
import { notifyWorkspaceChanged } from '../../../shared/lib';
import { WorkspaceAssociationSelector } from './WorkspaceAssociationSelector';

export class LogisticsWorkspaceAssociateActionModel extends AssociateActionModel {
  async associateSelectedRows() {
    await super.associateSelectedRows();
    notifyWorkspaceChanged(this.flowEngine);
  }
}
const associateMetadata = AssociateActionModel.meta;
if (!associateMetadata) throw new Error('Associate action metadata is not registered');
LogisticsWorkspaceAssociateActionModel.define(associateMetadata);
LogisticsWorkspaceAssociateActionModel.registerFlow({
  key: 'associateSettings',
  on: 'click',
  steps: {
    openSelector: {
      async handler(ctx) {
        const model = ctx.model as LogisticsWorkspaceAssociateActionModel;
        model.selectedRows = [];
        await ctx.viewer.open({
          type: 'dialog',
          width: '80%',
          inheritContext: false,
          target: ctx.layoutContentElement,
          inputArgs: {
            parentId: model.uid,
            scene: 'select',
            ...getAssociationTargetResourceSettings(ctx),
            ...getAssociationSelectorContextInputArgs(ctx),
            rowSelectionProps: {
              type: 'checkbox',
              // Match the native selector: its onChange replaces the table's controlled selection handler.
              selectedRowKeys: undefined,
              renderCell: undefined,
              onChange: (_: unknown, rows: unknown[]) => {
                model.selectedRows = rows || [];
              },
            },
          },
          content: () => <WorkspaceAssociationSelector model={model} />,
        });
      },
    },
  },
});

export class LogisticsWorkspaceShipmentAddActionModel extends LogisticsWorkspaceNewShipmentActionModel {
  private async associate() {
    const model = this.subModels?.associate as unknown as AssociateActionModel;
    await model.dispatchEvent('click', { mode: 'dialog', size: 'large' }, { debounce: false });
  }

  render() {
    if (this.context.flowSettingsEnabled)
      return (
        <>
          {super.render()}
          <FlowModelRenderer model={this.subModels?.associate as FlowModel} showFlowSettings={true} />
        </>
      );
    if (this.forbidden) return super.render();
    return (
      <Dropdown
        trigger={['click']}
        disabled={Boolean(this.props.loading || this.props.disabled)}
        menu={{
          items: [
            { key: 'create', label: 'Создать новую поставку' },
            { key: 'associate', label: 'Привязать существующую' },
          ],
          onClick: ({ key, domEvent }) => (key === 'create' ? this.onClick(domEvent) : this.associate()),
        }}
      >
        <Button type="primary" icon={<PlusOutlined />} loading={this.props.loading}>
          Добавить поставку <DownOutlined />
        </Button>
      </Dropdown>
    );
  }
}
LogisticsWorkspaceShipmentAddActionModel.define({ label: 'Добавить или привязать поставку' });

export class LogisticsWorkspaceDisassociateActionModel extends DisassociateActionModel {
  render() {
    if (this.context.flowSettingsEnabled || this.forbidden) return super.render();
    return (
      <Tooltip title="Отвязать">
        <Button
          size="small"
          type="text"
          disabled={Boolean(this.props.disabled)}
          loading={this.props.loading}
          icon={<DisconnectOutlined />}
          aria-label="Отвязать"
          onClick={(event) => this.onClick(event)}
        />
      </Tooltip>
    );
  }
}
const detachMetadata = DisassociateActionModel.meta;
if (!detachMetadata) throw new Error('Disassociate action metadata is not registered');
LogisticsWorkspaceDisassociateActionModel.define(detachMetadata);
LogisticsWorkspaceDisassociateActionModel.registerFlow({
  key: 'workspaceAfterDisassociate',
  on: 'click',
  sort: 1000,
  steps: {
    refresh: {
      handler(ctx) {
        notifyWorkspaceChanged(ctx.model.flowEngine);
      },
    },
  },
});
