/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAPIClient } from '@nocobase/client';
import { Alert, App, Button, Card, Empty, Flex, Input, Result, Select, Space, Spin, Typography } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LOGISTICS_STATUS_LABELS, LOGISTICS_STATUS_VALUES } from '../../../../shared/logistics';
import { apiErrorMessage } from '../api/apiResponse';
import { LogisticsService } from '../api/LogisticsService';
import {
  buildLogisticsWorkItems,
  EMPTY_LOGISTICS_WORKSPACE_FILTERS,
  filterLogisticsWorkItems,
  type LogisticsWorkspaceFilters,
  type LogisticsWorkspaceView,
  type LogisticsWorkItem,
} from '../model/workspace';
import type { LogisticsReferenceData, ShipmentRecord, TransportRunRecord } from '../model/types';
import { useLogisticsPermissions } from '../model/useLogisticsPermissions';
import { LogisticsWorkspaceTable } from './LogisticsWorkspaceTable';
import { RunModal } from './RunModal';
import { ShipmentFormModal } from './ShipmentFormModal';
import './styles.less';

const EMPTY_REFERENCE_DATA: LogisticsReferenceData = {
  chineseClients: [],
  companies: [],
  contracts: [],
  customsWarehouses: [],
  departureCities: [],
  users: [],
};

const WORKSPACE_VIEW_OPTIONS: Array<{ value: LogisticsWorkspaceView; label: string }> = [
  { value: 'primary', label: 'Основной вид' },
  { value: 'manager', label: 'Вид менеджера' },
  { value: 'declarant', label: 'Вид декларанта' },
  { value: 'all', label: 'Все поля' },
];

export function LogisticsPage() {
  const api = useAPIClient();
  const service = useMemo(() => new LogisticsService(api), [api]);
  const permissions = useLogisticsPermissions();
  const { message, modal } = App.useApp();
  const [runs, setRuns] = useState<TransportRunRecord[]>([]);
  const [referenceData, setReferenceData] = useState<LogisticsReferenceData>(EMPTY_REFERENCE_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LogisticsWorkspaceFilters>(EMPTY_LOGISTICS_WORKSPACE_FILTERS);
  const [view, setView] = useState<LogisticsWorkspaceView>('primary');
  const [editingRun, setEditingRun] = useState<TransportRunRecord | null>(null);
  const [runInitialTab, setRunInitialTab] = useState<'run' | 'shipments' | 'history'>('run');
  const [creatingRun, setCreatingRun] = useState(false);
  const [editingShipment, setEditingShipment] = useState<ShipmentRecord | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [runItems, references] = await Promise.all([service.getRuns(), service.getReferenceData()]);
      setRuns(runItems);
      setReferenceData(references);
    } catch (reason) {
      setError(apiErrorMessage(reason, 'Не удалось загрузить рабочий список логистики'));
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    load().catch((reason: unknown) =>
      setError(apiErrorMessage(reason, 'Не удалось загрузить рабочий список логистики')),
    );
  }, [load]);

  const workItems = useMemo(() => filterLogisticsWorkItems(buildLogisticsWorkItems(runs), filters), [filters, runs]);
  const filterOptions = useMemo(
    () => ({
      managers: referenceData.users.map((user) => ({ value: user.id, label: user.label })),
      declarants: referenceData.users.map((user) => ({ value: user.id, label: user.label })),
      statuses: LOGISTICS_STATUS_VALUES.map((status) => ({ value: status, label: LOGISTICS_STATUS_LABELS[status] })),
    }),
    [referenceData.users],
  );

  const updateFilters = useCallback((changes: Partial<LogisticsWorkspaceFilters>): void => {
    setFilters((current) => ({ ...current, ...changes }));
  }, []);

  const openRun = useCallback((item: LogisticsWorkItem, initialTab: 'run' | 'shipments' | 'history'): void => {
    setEditingRun(item.run);
    setRunInitialTab(initialTab);
  }, []);

  const closeRun = useCallback((): void => {
    setCreatingRun(false);
    setEditingRun(null);
    setRunInitialTab('run');
  }, []);

  const closeShipment = useCallback((): void => setEditingShipment(null), []);

  const shipmentSaved = useCallback(async (): Promise<void> => {
    closeShipment();
    await load();
    message.success('Поставка обновлена');
  }, [closeShipment, load, message]);

  const deleteRun = useCallback(
    (item: LogisticsWorkItem): void => {
      modal.confirm({
        title: `Удалить рейс №${item.run.runNumber}?`,
        content: 'Связанные поставки сохранятся; удалятся только рейс и его связи.',
        okText: 'Удалить',
        okButtonProps: { danger: true },
        cancelText: 'Отмена',
        async onOk() {
          try {
            await service.deleteRun(item.run.id);
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
              Общий рабочий список рейсов и поставок. Каждая строка показывает поставку в конкретном рейсе.
            </Typography.Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
              Обновить
            </Button>
            {permissions.canCreateRun ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreatingRun(true)}>
                Создать рейс
              </Button>
            ) : null}
          </Space>
        </Flex>
        {error ? (
          <Alert type="error" showIcon message={error} action={<Button onClick={load}>Повторить</Button>} />
        ) : null}
        <Card className="lc-logistics-card">
          <Flex gap="small" wrap="wrap" className="lc-logistics-panel-toolbar">
            <Input.Search
              allowClear
              placeholder="Машина, рейс, поставка, клиент, ДТ"
              value={filters.search}
              onChange={(event) => updateFilters({ search: event.target.value })}
              style={{ minWidth: 280, flex: 1 }}
            />
            <Select
              allowClear
              placeholder="Статус"
              options={filterOptions.statuses}
              value={filters.status || undefined}
              onChange={(status: string | undefined) => updateFilters({ status: status || null })}
              style={{ minWidth: 180 }}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Менеджер"
              options={filterOptions.managers}
              value={filters.managerId || undefined}
              onChange={(managerId: string | undefined) => updateFilters({ managerId: managerId || null })}
              style={{ minWidth: 180 }}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Декларант"
              options={filterOptions.declarants}
              value={filters.declarantId || undefined}
              onChange={(declarantId: string | undefined) => updateFilters({ declarantId: declarantId || null })}
              style={{ minWidth: 180 }}
            />
            <Select
              aria-label="Представление таблицы"
              options={WORKSPACE_VIEW_OPTIONS}
              value={view}
              onChange={setView}
              style={{ minWidth: 180 }}
            />
            <Button onClick={() => setFilters(EMPTY_LOGISTICS_WORKSPACE_FILTERS)}>Сбросить фильтры</Button>
          </Flex>
          {loading && runs.length === 0 ? (
            <div className="lc-logistics-loading">
              <Spin size="large" />
            </div>
          ) : workItems.length === 0 ? (
            <Empty description="По выбранным условиям рейсы и поставки не найдены" />
          ) : (
            <LogisticsWorkspaceTable
              items={workItems}
              view={view}
              canEditRun={permissions.canUpdateRun}
              canDeleteRun={permissions.canDeleteRun}
              canEditShipment={permissions.canUpdateShipment}
              onEditRun={(item) => openRun(item, 'run')}
              onManageRunShipments={(item) => openRun(item, 'shipments')}
              onDeleteRun={deleteRun}
              onEditShipment={(item) => {
                if (item.shipment) {
                  setEditingShipment(item.shipment);
                }
              }}
            />
          )}
        </Card>
        <RunModal
          open={creatingRun || Boolean(editingRun)}
          run={editingRun}
          runs={runs}
          initialTab={runInitialTab}
          referenceData={referenceData}
          service={service}
          permissions={permissions}
          onClose={closeRun}
          onChanged={load}
        />
        <ShipmentFormModal
          open={Boolean(editingShipment)}
          shipment={editingShipment}
          referenceData={referenceData}
          service={service}
          canSave={editingShipment ? permissions.canUpdateShipment(editingShipment.id) : false}
          onClose={closeShipment}
          onSaved={shipmentSaved}
        />
      </main>
    </App>
  );
}
