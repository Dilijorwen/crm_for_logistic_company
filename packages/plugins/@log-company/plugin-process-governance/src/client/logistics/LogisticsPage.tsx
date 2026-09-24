/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAPIClient } from '@nocobase/client';
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Flex,
  Result,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  type TableColumnsType,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LOGISTICS_STATUS_LABELS, type LogisticsStatus } from '../../shared/logistics';
import { apiErrorMessage } from './apiResponse';
import { LogisticsService } from './LogisticsService';
import { RunModal } from './RunModal';
import type { LogisticsReferenceData, TransportRunRecord } from './types';
import { useLogisticsPermissions } from './useLogisticsPermissions';
import './styles.less';

const EMPTY_REFERENCE_DATA: LogisticsReferenceData = {
  chineseClients: [],
  companies: [],
  contracts: [],
  customsWarehouses: [],
  departureCities: [],
  users: [],
};

function formatDate(value: string): string {
  if (!value) {
    return '—';
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function names(items: Array<{ label: string }>): string {
  return items.map((item) => item.label).join(', ') || '—';
}

export function LogisticsPage() {
  const api = useAPIClient();
  const service = useMemo(() => new LogisticsService(api), [api]);
  const permissions = useLogisticsPermissions();
  const { message, modal } = App.useApp();
  const [runs, setRuns] = useState<TransportRunRecord[]>([]);
  const [referenceData, setReferenceData] = useState<LogisticsReferenceData>(EMPTY_REFERENCE_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TransportRunRecord | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [runItems, references] = await Promise.all([service.getRuns(), service.getReferenceData()]);
      setRuns(runItems);
      setReferenceData(references);
    } catch (reason) {
      setError(apiErrorMessage(reason, 'Не удалось загрузить рейсы'));
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    load().catch((reason: unknown) => setError(apiErrorMessage(reason, 'Не удалось загрузить рейсы')));
  }, [load]);

  const deleteRun = useCallback(
    (run: TransportRunRecord): void => {
      modal.confirm({
        title: `Удалить рейс №${run.runNumber}?`,
        content: 'Связанные поставки сохранятся; удалятся только рейс и его связи.',
        okText: 'Удалить',
        okButtonProps: { danger: true },
        cancelText: 'Отмена',
        async onOk() {
          try {
            await service.deleteRun(run.id);
            await load();
            message.success('Рейс удалён');
          } catch (reason) {
            message.error(apiErrorMessage(reason, 'Не удалось удалить рейс'));
          }
        },
      });
    },
    [load, message, modal, service],
  );

  const columns = useMemo<TableColumnsType<TransportRunRecord>>(
    () => [
      { title: 'Номер рейса', dataIndex: 'runNumber', width: 100 },
      { title: 'Номер машины', dataIndex: 'registrationNumber', width: 160 },
      {
        title: 'Статус',
        dataIndex: 'status',
        width: 190,
        render: (value: string) => <Tag color="blue">{LOGISTICS_STATUS_LABELS[value as LogisticsStatus] || value}</Tag>,
      },
      { title: 'Дата создания', dataIndex: 'createdAt', width: 160, render: formatDate },
      {
        title: 'Город отправления',
        dataIndex: 'departureCity',
        width: 180,
        render: (value: TransportRunRecord['departureCity']) => value?.label || '—',
      },
      { title: 'Менеджеры', dataIndex: 'managers', width: 200, render: names },
      { title: 'Декларанты', dataIndex: 'declarants', width: 200, render: names },
      {
        title: 'Поставки',
        dataIndex: 'shipments',
        width: 110,
        align: 'center',
        render: (value: TransportRunRecord['shipments']) => value.length,
      },
      {
        title: 'Действия',
        key: 'actions',
        fixed: 'right',
        width: 120,
        render: (_, run) => (
          <Space>
            <Button type="text" icon={<EditOutlined />} aria-label="Редактировать" onClick={() => setEditing(run)} />
            {permissions.canDeleteRun(run.id) ? (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                aria-label="Удалить"
                onClick={() => deleteRun(run)}
              />
            ) : null}
          </Space>
        ),
      },
    ],
    [deleteRun, permissions],
  );

  if (!permissions.canViewRuns) {
    return <Result status="403" title="403" subTitle="У вашей роли нет доступа к рейсам." />;
  }

  return (
    <App>
      <main className="lc-logistics-page">
        <Flex justify="space-between" align="center" gap="middle" wrap="wrap" className="lc-logistics-header">
          <div>
            <Typography.Title level={3} className="lc-logistics-title">
              Таможенное оформление
            </Typography.Title>
            <Typography.Text type="secondary">
              Рейсы объединяют машины, ответственных сотрудников и связанные поставки.
            </Typography.Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
              Обновить
            </Button>
            {permissions.canCreateRun ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
                Создать рейс
              </Button>
            ) : null}
          </Space>
        </Flex>
        {error ? (
          <Alert type="error" showIcon message={error} action={<Button onClick={load}>Повторить</Button>} />
        ) : null}
        <Card className="lc-logistics-card">
          {loading && runs.length === 0 ? (
            <div className="lc-logistics-loading">
              <Spin size="large" />
            </div>
          ) : runs.length === 0 ? (
            <Empty description="Рейсов пока нет" />
          ) : (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={runs}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              scroll={{ x: 1450 }}
              onRow={(run) => ({ onDoubleClick: () => setEditing(run) })}
            />
          )}
        </Card>
        <RunModal
          open={creating || Boolean(editing)}
          run={editing}
          runs={runs}
          referenceData={referenceData}
          service={service}
          permissions={permissions}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onChanged={load}
        />
      </main>
    </App>
  );
}
