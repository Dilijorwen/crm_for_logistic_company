/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { Space, Tag } from 'antd';
import { useRecord, DisplayEnumFieldModel } from '@nocobase/client';
import { DisplayItemModel } from '@nocobase/flow-engine';

type StatusProps = React.PropsWithChildren<{
  value?: string | null;
  rentalStatus?: string | null;
}>;
const labels: Record<string, string> = { valid: 'Действителен', suspended: 'Приостановлен', terminated: 'Прекращен' };

export function PermitStatusTags({ value, rentalStatus }: StatusProps) {
  return (
    <Space size={4} wrap>
      {value ? <Tag>{labels[value] ?? value}</Tag> : '—'}
      {rentalStatus === 'expired' && <Tag color="orange">Аренда истекла</Tag>}
    </Space>
  );
}

export function PermitDocumentStatus(props: StatusProps) {
  const record = useRecord() as { rental_status?: string } | undefined;
  return <PermitStatusTags {...props} rentalStatus={record?.rental_status} />;
}

export class PermitDocumentStatusFieldModel extends DisplayEnumFieldModel {
  isEmpty(value: unknown) {
    return this.context.record?.rental_status === 'expired' ? false : super.isEmpty(value);
  }
  renderComponent(value: unknown) {
    return [
      <PermitStatusTags
        key="permit-status"
        value={typeof value === 'string' ? value : null}
        rentalStatus={this.context.record?.rental_status}
      />,
    ];
  }
}
PermitDocumentStatusFieldModel.define({ label: 'Статус разрешительного документа' });
DisplayItemModel.bindModelToInterface('PermitDocumentStatusFieldModel', 'select', {
  isDefault: true,
  when: (_context, field) => field.collectionName === 'permit_documents' && field.name === 'status',
});
