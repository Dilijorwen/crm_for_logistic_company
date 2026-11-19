/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ExpandOutlined } from '@ant-design/icons';
import { Alert, Button, Collapse, Descriptions, Empty, Popover, Skeleton, Space, Tabs, Tag, Typography } from 'antd';
import React from 'react';
import { LOGISTICS_STATUS_COLORS, LOGISTICS_STATUS_LABELS, type LogisticsStatus } from '../../../../shared/logistics';
import { TRANSPORT_TYPE_LABELS, type TransportType } from '../../../../shared/transport';
import { ScopedNativeBlock } from '../../../features/scoped-native-block';
import {
  openWorkspaceRun,
  WorkspaceShipmentAddButton,
  WorkspaceSharedShipmentBadge,
  WorkspaceShipmentDetachButton,
} from '../../../features/workspace-actions';
import { useWorkspaceTable } from '../model/WorkspaceTableContext';
import type { WorkspaceRunGroup } from '../model/workspaceGroups';
import { useRunSummary } from '../model/useRunSummary';
import { rowText, transportIcon } from './WorkspaceRunHeader';

function Overview({ group }: { group: WorkspaceRunGroup }) {
  const { table } = useWorkspaceTable();
  const state = useRunSummary(table, group.id);
  if (state.loading) return <Skeleton active />;
  if (state.error || !state.data)
    return (
      <Alert
        type="error"
        showIcon
        message="Не удалось загрузить сведения рейса"
        action={<Button onClick={state.reload}>Повторить</Button>}
      />
    );
  const summary = state.data;
  const links = (items: typeof summary.parents) =>
    items.length ? (
      <Space direction="vertical">
        {items.map((run) => (
          <Typography.Link key={run.id} onClick={() => openWorkspaceRun(table, run.id)}>
            №{run.number} · {run.registration}
          </Typography.Link>
        ))}
      </Space>
    ) : (
      <Typography.Text type="secondary">Не указаны</Typography.Text>
    );
  return (
    <Collapse
      defaultActiveKey={['data', 'people', 'shipments', 'links']}
      items={[
        {
          key: 'data',
          label: 'Данные рейса',
          children: (
            <Descriptions
              size="small"
              column={1}
              items={[{ key: 'city', label: 'Город отправления', children: rowText(group.row, 'departure_city_name') }]}
            />
          ),
        },
        {
          key: 'people',
          label: 'Ответственные',
          children: (
            <Descriptions
              size="small"
              column={1}
              items={[
                {
                  key: 'managers',
                  label: 'Менеджеры',
                  children: summary.managers.map((person) => person.name).join(', ') || 'Не назначены',
                },
                {
                  key: 'declarants',
                  label: 'Декларанты',
                  children: summary.declarants.map((person) => person.name).join(', ') || 'Не назначены',
                },
              ]}
            />
          ),
        },
        {
          key: 'shipments',
          label: `Поставки · ${summary.shipments.length}`,
          children: (
            <>
              {summary.shipments.map((shipment) => (
                <div className="lc-workspace-summary-shipment" key={shipment.id}>
                  <div>
                    <Typography.Text>
                      №{shipment.number} · {shipment.client}
                    </Typography.Text>
                    <div className="lc-workspace-secondary">Инвойс: {shipment.invoice}</div>
                    {(shipment.declaration || shipment.application) && (
                      <div className="lc-workspace-secondary">
                        {shipment.declaration ? `ДТ: ${shipment.declaration}` : `ЗВ: ${shipment.application}`}
                      </div>
                    )}
                    <WorkspaceSharedShipmentBadge host={table} shipmentId={shipment.id} />
                  </div>
                  <Tag color={LOGISTICS_STATUS_COLORS[shipment.status as LogisticsStatus]}>
                    {LOGISTICS_STATUS_LABELS[shipment.status as LogisticsStatus] || shipment.status || '—'}
                  </Tag>
                  <WorkspaceShipmentDetachButton host={table} runId={group.id} shipmentId={shipment.id} />
                </div>
              ))}
              <Space wrap>
                {!summary.shipments.length && <Typography.Text type="secondary">Поставок пока нет</Typography.Text>}
                <WorkspaceShipmentAddButton host={table} runId={group.id} rowId={group.row.id} />
              </Space>
            </>
          ),
        },
        {
          key: 'links',
          label: 'Связи рейсов',
          children: (
            <Space direction="vertical">
              <div>Основные рейсы: {links(summary.parents)}</div>
              <div>Зависимые рейсы: {links(summary.children)}</div>
              <Popover
                trigger="click"
                placement="bottomRight"
                destroyTooltipOnHide
                content={<ScopedNativeBlock host={table} templateUid="lcwssidelinks" runId={group.id} />}
              >
                <Button>Изменить связи</Button>
              </Popover>
            </Space>
          ),
        },
      ]}
    />
  );
}

export function WorkspaceRunSidebar() {
  const state = useWorkspaceTable();
  const group = state.groups.find((item) => item.id === state.selectedRunId);
  if (!group)
    return (
      <aside className="lc-workspace-sidebar">
        <Empty description="Выберите рейс, чтобы посмотреть информацию" />
      </aside>
    );
  return (
    <aside className="lc-workspace-sidebar" aria-label="Информация о рейсе">
      <div className="lc-workspace-sidebar-heading">
        <Typography.Text strong>Информация о рейсе</Typography.Text>
        <Button
          type="text"
          icon={<ExpandOutlined />}
          aria-label="Открыть полную карточку рейса"
          onClick={() => openWorkspaceRun(state.table, group.id, group.row.id)}
        />
      </div>
      <Typography.Title level={4}>
        <Space wrap size="small">
          <span role="img" aria-label={TRANSPORT_TYPE_LABELS[group.row.transport_type as TransportType]}>
            {transportIcon(group.row.transport_type)}
          </span>
          <span>Рейс №{rowText(group.row, 'run_number')}</span>
          <span>{rowText(group.row, 'registration_number')}</span>
        </Space>
      </Typography.Title>
      <Tabs
        key={group.id}
        items={[
          { key: 'overview', label: 'Обзор', children: <Overview group={group} /> },
          {
            key: 'tree',
            label: 'Дерево',
            children: <ScopedNativeBlock host={state.table} templateUid="lcwssidetree" runId={group.id} />,
          },
        ]}
      />
    </aside>
  );
}
