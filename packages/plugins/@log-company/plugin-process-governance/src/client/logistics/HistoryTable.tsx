/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Alert, Empty, Spin, Table, type TableColumnsType } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LOGISTICS_HISTORY_EVENT_LABELS, LOGISTICS_STATUS_LABELS, type LogisticsStatus } from '../../shared/logistics';
import { apiErrorMessage } from './apiResponse';
import type { LogisticsService } from './LogisticsService';
import type { LogisticsHistoryRecord } from './types';

interface HistoryTableProps {
  entityId: string;
  entityKind: 'run' | 'shipment';
  service: LogisticsService;
  revision?: number;
}

function formatDate(value: string): string {
  if (!value) {
    return '—';
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

const FIELD_LABELS: Record<string, string> = {
  status: 'Статус',
  vehicle: 'Номер машины',
  departure_city: 'Город отправления',
  managers: 'Менеджеры',
  declarants: 'Декларанты',
  parent_runs: 'Родительские рейсы',
  child_runs: 'Дочерние рейсы',
  shipments: 'Поставки',
  runs: 'Рейсы',
  chinese_client: 'Китайский клиент',
  company: 'Наша компания',
  route_delivery_number: 'Номер доставки',
  invoice_number: 'Номер инвойса',
  invoice_value: 'Стоимость по инвойсу',
  contract_record: 'Контракт',
  customs_scheme: 'Таможенная схема',
  customs_warehouse: 'СВХ',
  customs_warehouse_storage_date: 'Дата размещения на СВХ',
  declaration_number: 'Номер декларации',
  application_number: 'Номер заявления',
  documents_in_badis: 'Документы в БАДИС',
  customs_payments_amount: 'Сумма таможенных платежей',
  eco_fee: 'Экологический сбор',
  ktc_amount: 'Сумма КТС',
  ntm_certificate_goods: 'Товары для сертификата НТМ',
  ntm_skk_goods: 'Товары для СКК НТМ',
  ntm_kfk_goods: 'Товары для КФК НТМ',
  ntm_honest_sign_goods: 'Товары для «Честного знака» НТМ',
  ntm_export_declaration_required: 'Требуется экспортная декларация НТМ',
  ntm_honest_sign_sum: 'Сумма «Честного знака» НТМ',
  goods_count: 'Количество товаров',
  entered_in_1c: 'Внесено в 1С',
  sent_to_client: 'Отправлено клиенту',
  declaration_release_date: 'Дата выпуска декларации',
  application_release_date: 'Дата выпуска заявления',
  additional_check_response_deadline: 'Срок ответа по дополнительной проверке',
  actual_control: 'Фактический контроль',
  anosov_distributed: 'Распределено Аносовым',
  manager_comment: 'Комментарий менеджера',
};

const CUSTOMS_SCHEME_LABELS: Record<string, string> = {
  operator: 'Оператор',
  els: 'ЕЛС',
};

export function HistoryTable({ entityId, entityKind, service, revision = 0 }: HistoryTableProps) {
  const [items, setItems] = useState<LogisticsHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatHistoryValue = useCallback((fieldName: string, value: string): string => {
    if (!value) {
      return '—';
    }
    if (value === 'true' || value === 'false') {
      return value === 'true' ? 'Да' : 'Нет';
    }
    if (fieldName === 'status') {
      return LOGISTICS_STATUS_LABELS[value as LogisticsStatus] || value;
    }
    if (fieldName === 'customs_scheme') {
      return CUSTOMS_SCHEME_LABELS[value] || value;
    }
    return value;
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const loadHistory = async (): Promise<void> => {
      try {
        const records =
          entityKind === 'run' ? await service.getRunHistory(entityId) : await service.getShipmentHistory(entityId);
        if (active) {
          setItems(records);
        }
      } catch (reason) {
        if (active) {
          setError(apiErrorMessage(reason, 'Не удалось загрузить историю'));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    loadHistory().catch((reason: unknown) => {
      if (active) {
        setError(apiErrorMessage(reason, 'Не удалось загрузить историю'));
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [entityId, entityKind, revision, service]);

  const columns = useMemo<TableColumnsType<LogisticsHistoryRecord>>(
    () => [
      { title: 'Дата', dataIndex: 'createdAt', width: 160, render: formatDate },
      {
        title: 'Автор',
        dataIndex: 'createdBy',
        width: 160,
        render: (value: string) => value || '—',
      },
      {
        title: 'Событие',
        dataIndex: 'eventType',
        width: 180,
        render: (value: string) => LOGISTICS_HISTORY_EVENT_LABELS[value] || value,
      },
      {
        title: 'Поле',
        width: 190,
        render: (_, record) =>
          record.fieldName ? FIELD_LABELS[record.fieldName] || record.fieldLabel || record.fieldName : '—',
      },
      {
        title: 'Было',
        dataIndex: 'oldValue',
        render: (value: string, record) => formatHistoryValue(record.fieldName, value),
      },
      {
        title: 'Стало',
        dataIndex: 'newValue',
        render: (value: string, record) => formatHistoryValue(record.fieldName, value),
      },
    ],
    [formatHistoryValue],
  );

  if (loading && items.length === 0) {
    return <Spin />;
  }
  if (error) {
    return <Alert type="error" showIcon message={error} />;
  }
  if (items.length === 0) {
    return <Empty description="История пока пуста" />;
  }
  return (
    <Table rowKey="id" size="small" columns={columns} dataSource={items} pagination={false} scroll={{ x: 1050 }} />
  );
}
