/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Space, Tag, Typography } from 'antd';
import { WorkspaceReturnButton } from '../../../features/workspace-actions';
import React from 'react';
import { ShipmentSynchronizedEditFormModel } from '../../../features/synchronize-shipment-form';
import { WorkspaceRecordHeader } from '../../../features/workspace-record-header';
import { workspaceAnchors } from '../../../shared/lib';
import { LOGISTICS_STATUS_LABELS, type LogisticsStatus } from '../../../../shared/logistics';

interface NativeFormProps {
  actions?: React.ReactNode;
}

export class LogisticsWorkspaceShipmentEditFormModel extends ShipmentSynchronizedEditFormModel {
  renderComponent() {
    const rendered = super.renderComponent();
    if (!React.isValidElement<NativeFormProps>(rendered)) return rendered;
    const ids = workspaceAnchors(this.context.view?.inputArgs);
    const current = this.getCurrentRecord() as Record<string, unknown> | undefined;
    const status = typeof current?.status === 'string' ? (current.status as LogisticsStatus) : undefined;
    return (
      <>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 16,
          }}
        >
          <div>
            <WorkspaceReturnButton host={this} />
            {ids.shipmentId ? (
              <WorkspaceRecordHeader context={this.context} entity="shipment" recordId={ids.shipmentId} level={2} />
            ) : null}
            <Space>
              {status ? (
                <Tag color={status === 'release' ? 'success' : status === 'queue' ? 'default' : 'processing'}>
                  {LOGISTICS_STATUS_LABELS[status]}
                </Tag>
              ) : null}
              {typeof current?.invoice_number === 'string' ? (
                <Typography.Text>{current.invoice_number}</Typography.Text>
              ) : null}
            </Space>
          </div>
          {rendered.props.actions}
        </div>
        {React.cloneElement(rendered, { actions: null })}
      </>
    );
  }
}
const metadata = ShipmentSynchronizedEditFormModel.meta;
if (!metadata) throw new Error('Edit form metadata is not registered');
LogisticsWorkspaceShipmentEditFormModel.define({
  ...metadata,
  hide: true,
});
