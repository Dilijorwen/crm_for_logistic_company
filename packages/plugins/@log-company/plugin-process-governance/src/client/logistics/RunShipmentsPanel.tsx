/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { EditOutlined, LinkOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import { Alert, App, Button, Empty, Flex, Select, Space, Spin, Table, Tag, type TableColumnsType } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiErrorMessage } from './apiResponse';
import type { LogisticsService } from './LogisticsService';
import { ShipmentFormModal } from './ShipmentFormModal';
import type { LogisticsReferenceData, ShipmentRecord } from './types';

interface RunShipmentsPanelProps {
  runId: string;
  referenceData: LogisticsReferenceData;
  service: LogisticsService;
  canManageLinks: boolean;
  canCreateShipment: boolean;
  canUpdateShipment: (shipmentId: string) => boolean;
  onChanged: () => Promise<void>;
}

export function RunShipmentsPanel({
  runId,
  referenceData,
  service,
  canManageLinks,
  canCreateShipment,
  canUpdateShipment,
  onChanged,
}: RunShipmentsPanelProps) {
  const { message, modal } = App.useApp();
  const [items, setItems] = useState<ShipmentRecord[]>([]);
  const [available, setAvailable] = useState<ShipmentRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<ShipmentRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [linked, all] = await Promise.all([service.getRunShipments(runId), service.getAvailableShipments()]);
      setItems(linked);
      const linkedIds = new Set(linked.map((item) => item.id));
      setAvailable(all.filter((item) => !linkedIds.has(item.id)));
    } catch (reason) {
      setError(apiErrorMessage(reason, 'Не удалось загрузить поставки'));
    } finally {
      setLoading(false);
    }
  }, [runId, service]);

  useEffect(() => {
    load().catch((reason: unknown) => setError(apiErrorMessage(reason, 'Не удалось загрузить поставки')));
  }, [load]);

  const refresh = async (): Promise<void> => {
    await Promise.all([load(), onChanged()]);
  };

  const attach = async (): Promise<void> => {
    if (selectedIds.length === 0) {
      return;
    }
    setMutating(true);
    try {
      await service.attachShipments(runId, selectedIds);
      setSelectedIds([]);
      await refresh();
      message.success('Поставки добавлены в рейс');
    } catch (reason) {
      message.error(apiErrorMessage(reason, 'Не удалось добавить поставку'));
    } finally {
      setMutating(false);
    }
  };

  const detach = useCallback(
    (shipment: ShipmentRecord): void => {
      modal.confirm({
        title: `Убрать поставку №${shipment.shipmentNumber} из этого рейса?`,
        okText: 'Убрать из рейса',
        cancelText: 'Отмена',
        async onOk() {
          await service.detachShipment(runId, shipment.id);
          await Promise.all([load(), onChanged()]);
          message.success('Поставка убрана из рейса');
        },
      });
    },
    [load, message, modal, onChanged, runId, service],
  );

  const shipmentSaved = async (created: ShipmentRecord | null): Promise<void> => {
    if (created) {
      await service.attachShipments(runId, [created.id]);
      message.success('Поставка создана и добавлена в рейс');
    } else {
      message.success('Поставка обновлена');
    }
    setCreating(false);
    setEditing(null);
    await refresh();
  };

  const columns = useMemo<TableColumnsType<ShipmentRecord>>(
    () => [
      { title: 'Номер поставки', dataIndex: 'shipmentNumber', width: 110 },
      { title: 'Название поставки', dataIndex: 'displayName', ellipsis: true },
      {
        title: 'Китайский клиент',
        dataIndex: 'chineseClient',
        render: (value: ShipmentRecord['chineseClient']) => value?.label || '—',
      },
      {
        title: 'Наша компания',
        dataIndex: 'company',
        render: (value: ShipmentRecord['company']) => value?.label || '—',
      },
      {
        title: 'Номер доставки',
        dataIndex: 'routeDeliveryNumber',
        render: (value: string) => value || '—',
      },
      {
        title: 'Номер декларации',
        dataIndex: 'declarationNumber',
        render: (value: string) => (value ? <Tag>{value}</Tag> : '—'),
      },
      {
        title: 'Действия',
        key: 'actions',
        fixed: 'right',
        width: 120,
        render: (_, record) => (
          <Space>
            <Button
              type="text"
              icon={<EditOutlined />}
              aria-label="Редактировать"
              disabled={!canUpdateShipment(record.id)}
              onClick={() => setEditing(record)}
            />
            {canManageLinks ? (
              <Button
                type="text"
                danger
                icon={<StopOutlined />}
                aria-label="Убрать из рейса"
                onClick={() => detach(record)}
              />
            ) : null}
          </Space>
        ),
      },
    ],
    [canManageLinks, canUpdateShipment, detach],
  );

  if (loading && items.length === 0) {
    return <Spin />;
  }

  return (
    <div>
      {error ? <Alert type="error" showIcon message={error} className="lc-logistics-panel-alert" /> : null}
      <Flex gap="small" wrap="wrap" className="lc-logistics-panel-toolbar">
        <Select
          mode="multiple"
          allowClear
          showSearch
          optionFilterProp="label"
          value={selectedIds}
          onChange={setSelectedIds}
          options={available.map((item) => ({
            value: item.id,
            label: item.displayName || `№${item.shipmentNumber}`,
          }))}
          placeholder="Выберите существующие поставки"
          disabled={!canManageLinks}
          style={{ minWidth: 320, flex: 1 }}
        />
        <Button
          icon={<LinkOutlined />}
          loading={mutating}
          disabled={!canManageLinks || selectedIds.length === 0}
          onClick={attach}
        >
          Добавить
        </Button>
        {canCreateShipment ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
            Создать поставку
          </Button>
        ) : null}
      </Flex>
      {items.length === 0 ? (
        <Empty description="К рейсу ещё не добавлены поставки" />
      ) : (
        <Table rowKey="id" size="small" columns={columns} dataSource={items} pagination={false} scroll={{ x: 900 }} />
      )}
      <ShipmentFormModal
        open={creating || Boolean(editing)}
        shipment={editing}
        referenceData={referenceData}
        service={service}
        canSave={editing ? canUpdateShipment(editing.id) : canCreateShipment}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={shipmentSaved}
      />
    </div>
  );
}
