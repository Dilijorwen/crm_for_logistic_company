/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DeleteOutlined, EditOutlined, LinkOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Space, Table, Tag, Tooltip, type TableColumnsType } from 'antd';
import React, { useMemo } from 'react';
import { LOGISTICS_STATUS_LABELS, type LogisticsStatus } from '../../../../shared/logistics';
import type { LogisticsWorkspaceView, LogisticsWorkItem } from '../model/workspace';

interface LogisticsWorkspaceTableProps {
  items: LogisticsWorkItem[];
  view: LogisticsWorkspaceView;
  canEditRun: (runId: string) => boolean;
  canDeleteRun: (runId: string) => boolean;
  canEditShipment: (shipmentId: string) => boolean;
  onEditRun: (item: LogisticsWorkItem) => void;
  onManageRunShipments: (item: LogisticsWorkItem) => void;
  onDeleteRun: (item: LogisticsWorkItem) => void;
  onEditShipment: (item: LogisticsWorkItem) => void;
}

type ColumnKey =
  | 'runNumber'
  | 'registrationNumber'
  | 'createdAt'
  | 'departureCity'
  | 'managers'
  | 'declarants'
  | 'parentRuns'
  | 'shipmentNumber'
  | 'chineseClient'
  | 'company'
  | 'status'
  | 'invoiceNumber'
  | 'invoiceValue'
  | 'contract'
  | 'customsScheme'
  | 'customsWarehouse'
  | 'customsWarehouseStorageDate'
  | 'declarationNumber'
  | 'applicationNumber'
  | 'documentsInBadis'
  | 'customsPaymentsAmount'
  | 'ecoFee'
  | 'ktcAmount'
  | 'ntmCertificateGoods'
  | 'ntmSkkGoods'
  | 'ntmKfkGoods'
  | 'ntmHonestSignGoods'
  | 'ntmExportDeclarationRequired'
  | 'ntmHonestSignSum'
  | 'goodsCount'
  | 'enteredIn1c'
  | 'sentToClient'
  | 'additionalCheckResponseDeadline'
  | 'actualControl'
  | 'anosovDistributed'
  | 'managerComment';

const VIEW_COLUMNS: Record<LogisticsWorkspaceView, ColumnKey[]> = {
  primary: [
    'runNumber',
    'registrationNumber',
    'managers',
    'declarants',
    'shipmentNumber',
    'chineseClient',
    'status',
    'declarationNumber',
  ],
  manager: [
    'runNumber',
    'registrationNumber',
    'departureCity',
    'managers',
    'shipmentNumber',
    'chineseClient',
    'company',
    'status',
    'invoiceNumber',
    'invoiceValue',
    'managerComment',
  ],
  declarant: [
    'runNumber',
    'registrationNumber',
    'declarants',
    'shipmentNumber',
    'chineseClient',
    'status',
    'customsScheme',
    'customsWarehouse',
    'declarationNumber',
    'applicationNumber',
    'additionalCheckResponseDeadline',
    'customsPaymentsAmount',
    'ktcAmount',
    'ntmHonestSignSum',
  ],
  all: [
    'runNumber',
    'registrationNumber',
    'createdAt',
    'departureCity',
    'managers',
    'declarants',
    'parentRuns',
    'shipmentNumber',
    'chineseClient',
    'company',
    'status',
    'invoiceNumber',
    'invoiceValue',
    'contract',
    'customsScheme',
    'customsWarehouse',
    'customsWarehouseStorageDate',
    'declarationNumber',
    'applicationNumber',
    'documentsInBadis',
    'customsPaymentsAmount',
    'ecoFee',
    'ktcAmount',
    'ntmCertificateGoods',
    'ntmSkkGoods',
    'ntmKfkGoods',
    'ntmHonestSignGoods',
    'ntmExportDeclarationRequired',
    'ntmHonestSignSum',
    'goodsCount',
    'enteredIn1c',
    'sentToClient',
    'additionalCheckResponseDeadline',
    'actualControl',
    'anosovDistributed',
    'managerComment',
  ],
};

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short' }).format(new Date(value));
}

function formatAmount(value: number | null): string {
  return value === null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
}

function formatBoolean(value: boolean): string {
  return value ? 'Да' : '—';
}

function referenceNames(items: Array<{ label: string }>): string {
  return items.map((item) => item.label).join(', ') || '—';
}

function shipmentValue(item: LogisticsWorkItem, value: string | number | null | undefined): string | number {
  return item.shipment ? value ?? '—' : '—';
}

export function LogisticsWorkspaceTable({
  items,
  view,
  canEditRun,
  canDeleteRun,
  canEditShipment,
  onEditRun,
  onManageRunShipments,
  onDeleteRun,
  onEditShipment,
}: LogisticsWorkspaceTableProps) {
  const columns = useMemo<TableColumnsType<LogisticsWorkItem>>(() => {
    const selected = new Set(VIEW_COLUMNS[view]);
    const has = (column: ColumnKey): boolean => selected.has(column);
    const runColumns: TableColumnsType<LogisticsWorkItem> = [];
    const shipmentColumns: TableColumnsType<LogisticsWorkItem> = [];

    if (has('runNumber')) {
      runColumns.push({ title: '№ рейса', width: 100, render: (_, item) => item.run.runNumber });
    }
    if (has('registrationNumber')) {
      runColumns.push({ title: 'Машина', width: 145, render: (_, item) => item.run.registrationNumber || '—' });
    }
    if (has('createdAt')) {
      runColumns.push({ title: 'Создан', width: 120, render: (_, item) => formatDate(item.run.createdAt) });
    }
    if (has('departureCity')) {
      runColumns.push({
        title: 'Город отправления',
        width: 180,
        render: (_, item) => item.run.departureCity?.label || '—',
      });
    }
    if (has('managers')) {
      runColumns.push({ title: 'Менеджеры', width: 190, render: (_, item) => referenceNames(item.run.managers) });
    }
    if (has('declarants')) {
      runColumns.push({ title: 'Декларанты', width: 190, render: (_, item) => referenceNames(item.run.declarants) });
    }
    if (has('parentRuns')) {
      runColumns.push({
        title: 'Родительские рейсы',
        width: 180,
        render: (_, item) => referenceNames(item.run.parentRuns),
      });
    }

    if (has('shipmentNumber')) {
      shipmentColumns.push({
        title: '№ поставки',
        width: 120,
        render: (_, item) => (item.shipment ? item.shipment.shipmentNumber : <Tag color="warning">Нет поставки</Tag>),
      });
    }
    if (has('chineseClient')) {
      shipmentColumns.push({
        title: 'Китайский клиент',
        width: 190,
        render: (_, item) => item.shipment?.chineseClient?.label || '—',
      });
    }
    if (has('company')) {
      shipmentColumns.push({
        title: 'Наша компания',
        width: 180,
        render: (_, item) => item.shipment?.company?.label || '—',
      });
    }
    if (has('status')) {
      shipmentColumns.push({
        title: 'Статус',
        width: 180,
        render: (_, item) =>
          item.shipment ? (
            <Tag color="blue">
              {LOGISTICS_STATUS_LABELS[item.shipment.status as LogisticsStatus] || item.shipment.status}
            </Tag>
          ) : (
            '—'
          ),
      });
    }
    if (has('invoiceNumber')) {
      shipmentColumns.push({
        title: 'Номер инвойса',
        width: 160,
        render: (_, item) => shipmentValue(item, item.shipment?.invoiceNumber),
      });
    }
    if (has('invoiceValue')) {
      shipmentColumns.push({
        title: 'Стоимость инвойса',
        width: 160,
        align: 'right',
        render: (_, item) => (item.shipment ? formatAmount(item.shipment.invoiceValue) : '—'),
      });
    }
    if (has('contract')) {
      shipmentColumns.push({
        title: 'Контракт',
        width: 160,
        render: (_, item) => item.shipment?.contract?.label || '—',
      });
    }
    if (has('customsScheme')) {
      shipmentColumns.push({
        title: 'Таможенная схема',
        width: 150,
        render: (_, item) => shipmentValue(item, item.shipment?.customsScheme),
      });
    }
    if (has('customsWarehouse')) {
      shipmentColumns.push({
        title: 'СВХ',
        width: 160,
        render: (_, item) => item.shipment?.customsWarehouse?.label || '—',
      });
    }
    if (has('customsWarehouseStorageDate')) {
      shipmentColumns.push({
        title: 'Дата СВХ',
        width: 130,
        render: (_, item) => (item.shipment ? formatDate(item.shipment.customsWarehouseStorageDate) : '—'),
      });
    }
    if (has('declarationNumber')) {
      shipmentColumns.push({
        title: 'Номер ДТ',
        width: 160,
        render: (_, item) => shipmentValue(item, item.shipment?.declarationNumber),
      });
    }
    if (has('applicationNumber')) {
      shipmentColumns.push({
        title: 'Номер заявления',
        width: 160,
        render: (_, item) => shipmentValue(item, item.shipment?.applicationNumber),
      });
    }
    if (has('documentsInBadis')) {
      shipmentColumns.push({
        title: 'Документы в БАДИС',
        width: 150,
        render: (_, item) => (item.shipment ? formatBoolean(item.shipment.documentsInBadis) : '—'),
      });
    }
    if (has('customsPaymentsAmount')) {
      shipmentColumns.push({
        title: 'Таможенные платежи',
        width: 170,
        align: 'right',
        render: (_, item) => (item.shipment ? formatAmount(item.shipment.customsPaymentsAmount) : '—'),
      });
    }
    if (has('ecoFee')) {
      shipmentColumns.push({
        title: 'Экосбор',
        width: 130,
        align: 'right',
        render: (_, item) => (item.shipment ? formatAmount(item.shipment.ecoFee) : '—'),
      });
    }
    if (has('ktcAmount')) {
      shipmentColumns.push({
        title: 'Сумма КТС',
        width: 130,
        align: 'right',
        render: (_, item) => (item.shipment ? formatAmount(item.shipment.ktcAmount) : '—'),
      });
    }
    if (has('ntmCertificateGoods')) {
      shipmentColumns.push({
        title: 'сертификат',
        width: 190,
        ellipsis: true,
        render: (_, item) => shipmentValue(item, item.shipment?.ntmCertificateGoods),
      });
    }
    if (has('ntmSkkGoods')) {
      shipmentColumns.push({
        title: 'СКК',
        width: 190,
        ellipsis: true,
        render: (_, item) => shipmentValue(item, item.shipment?.ntmSkkGoods),
      });
    }
    if (has('ntmKfkGoods')) {
      shipmentColumns.push({
        title: 'КФК',
        width: 190,
        ellipsis: true,
        render: (_, item) => shipmentValue(item, item.shipment?.ntmKfkGoods),
      });
    }
    if (has('ntmHonestSignGoods')) {
      shipmentColumns.push({
        title: 'Честный знак',
        width: 190,
        ellipsis: true,
        render: (_, item) => shipmentValue(item, item.shipment?.ntmHonestSignGoods),
      });
    }
    if (has('ntmExportDeclarationRequired')) {
      shipmentColumns.push({
        title: 'Экспортная ДТ',
        width: 170,
        render: (_, item) => (item.shipment ? formatBoolean(item.shipment.ntmExportDeclarationRequired) : '—'),
      });
    }
    if (has('ntmHonestSignSum')) {
      shipmentColumns.push({
        title: 'Сумма Честного знака',
        width: 180,
        align: 'right',
        render: (_, item) => (item.shipment ? formatAmount(item.shipment.ntmHonestSignSum) : '—'),
      });
    }
    if (has('goodsCount')) {
      shipmentColumns.push({
        title: 'Количество товаров',
        width: 170,
        align: 'right',
        render: (_, item) => shipmentValue(item, item.shipment?.goodsCount),
      });
    }
    if (has('enteredIn1c')) {
      shipmentColumns.push({
        title: 'Внесено в 1С',
        width: 140,
        render: (_, item) => (item.shipment ? formatBoolean(item.shipment.enteredIn1c) : '—'),
      });
    }
    if (has('sentToClient')) {
      shipmentColumns.push({
        title: 'Отправлено клиенту',
        width: 170,
        render: (_, item) => (item.shipment ? formatBoolean(item.shipment.sentToClient) : '—'),
      });
    }
    if (has('additionalCheckResponseDeadline')) {
      shipmentColumns.push({
        title: 'Срок ответа',
        width: 140,
        render: (_, item) => (item.shipment ? formatDate(item.shipment.additionalCheckResponseDeadline) : '—'),
      });
    }
    if (has('actualControl')) {
      shipmentColumns.push({
        title: 'Фактический контроль',
        width: 170,
        render: (_, item) => (item.shipment ? formatBoolean(item.shipment.actualControl) : '—'),
      });
    }
    if (has('anosovDistributed')) {
      shipmentColumns.push({
        title: 'Распределено Аносовым',
        width: 190,
        render: (_, item) => (item.shipment ? formatBoolean(item.shipment.anosovDistributed) : '—'),
      });
    }
    if (has('managerComment')) {
      shipmentColumns.push({
        title: 'Комментарий менеджера',
        width: 250,
        ellipsis: true,
        render: (_, item) => shipmentValue(item, item.shipment?.managerComment),
      });
    }

    return [
      { title: 'Рейс', children: runColumns },
      { title: 'Поставка', children: shipmentColumns },
      {
        title: 'Действия',
        key: 'actions',
        fixed: 'right',
        width: 132,
        render: (_, item) => (
          <Space size={0}>
            <Tooltip title="Редактировать поставку">
              <Button
                type="text"
                icon={<EditOutlined />}
                aria-label="Редактировать поставку"
                disabled={!item.shipment || !canEditShipment(item.shipment.id)}
                onClick={() => onEditShipment(item)}
              />
            </Tooltip>
            <Tooltip title="Настроить рейс и связи с поставками">
              <Button
                type="text"
                icon={<LinkOutlined />}
                aria-label="Настроить рейс и связи с поставками"
                disabled={!canEditRun(item.run.id)}
                onClick={() => onManageRunShipments(item)}
              />
            </Tooltip>
            <Tooltip title="Редактировать рейс">
              <Button
                type="text"
                icon={<SettingOutlined />}
                aria-label="Редактировать рейс"
                disabled={!canEditRun(item.run.id)}
                onClick={() => onEditRun(item)}
              />
            </Tooltip>
            {canDeleteRun(item.run.id) ? (
              <Tooltip title="Удалить рейс">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label="Удалить рейс"
                  onClick={() => onDeleteRun(item)}
                />
              </Tooltip>
            ) : null}
          </Space>
        ),
      },
    ];
  }, [canDeleteRun, canEditRun, canEditShipment, onDeleteRun, onEditRun, onEditShipment, onManageRunShipments, view]);

  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={items}
      pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (total) => `Всего: ${total}` }}
      scroll={{ x: 1700 }}
      onRow={(item) => ({
        onDoubleClick: () => {
          if (item.shipment && canEditShipment(item.shipment.id)) {
            onEditShipment(item);
          }
        },
      })}
    />
  );
}
