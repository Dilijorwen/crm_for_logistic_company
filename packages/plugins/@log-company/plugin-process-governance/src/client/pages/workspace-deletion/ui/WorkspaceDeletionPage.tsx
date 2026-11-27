/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ArrowLeftOutlined } from '@ant-design/icons';
import { DataSourceProvider, useAPIClient, useApp } from '@nocobase/client';
import { Alert, App, Button, Card, Checkbox, Empty, Grid, Pagination, Space, Spin, Typography } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WORKSPACE_PATH } from '../../../../shared/workspace';
import { useWorkspaceDeletionPermissions } from '../../../features/workspace-actions';
import { notifyWorkspaceChanged } from '../../../shared/lib';
import {
  deletionPageSize,
  WorkspaceDeletionApi,
  type DeletionPage,
  type DeletionShipment,
} from '../api/WorkspaceDeletionApi';

function useDeletionPage<T>(load: ((page: number) => Promise<DeletionPage<T>>) | undefined) {
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ page: number; data?: DeletionPage<T>; error?: true }>();
  useEffect(() => {
    if (!load) return;
    let active = true;
    setResult(undefined);
    load(page)
      .then((data) => {
        if (active) setResult({ page, data });
      })
      .catch(() => {
        if (active) setResult({ page, error: true });
      });
    return () => {
      active = false;
    };
  }, [load, page, retry]);
  const current = result?.page === page ? result : undefined;
  return { page, setPage, current, reload: () => setRetry((value) => value + 1) };
}

function ShipmentDetails({ shipment }: { shipment: DeletionShipment }) {
  return (
    <div style={{ overflowWrap: 'anywhere' }}>
      <Typography.Text strong>Поставка №{shipment.number}</Typography.Text>
      <div>{shipment.client}</div>
      <Typography.Text type="secondary">
        Инвойс {shipment.invoice} · ДТ {shipment.declaration} · ЗВ {shipment.application}
      </Typography.Text>
    </div>
  );
}

function SelectionSection<T>({
  title,
  count,
  state,
  columns,
  renderCards,
}: {
  title: string;
  count: string;
  state: ReturnType<typeof useDeletionPage<T>>;
  columns: number;
  renderCards: (rows: T[]) => React.ReactNode;
}) {
  const { current, page, setPage, reload } = state;
  return (
    <section aria-label={title} style={{ marginBottom: 28 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}
      >
        <Typography.Title level={3}>{title}</Typography.Title>
        <Typography.Text aria-live="polite">{count}</Typography.Text>
      </div>
      {!current ? (
        <Spin aria-label="Загрузка записей" />
      ) : current.error ? (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить список."
          action={<Button onClick={reload}>Повторить</Button>}
        />
      ) : current.data?.rows.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 16 }}>
          {renderCards(current.data.rows)}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Записей нет" />
      )}
      {current?.data && (current.data.total > deletionPageSize || page > 1) && (
        <Pagination
          aria-label={`Страницы: ${title}`}
          style={{ marginTop: 16, justifyContent: 'flex-end' }}
          current={page}
          pageSize={deletionPageSize}
          total={current.data.total}
          onChange={setPage}
          showSizeChanger={false}
        />
      )}
    </section>
  );
}

type ShipmentSection = 'linked' | 'standalone';

export function WorkspaceDeletionPage() {
  return (
    <DataSourceProvider dataSource="main">
      <WorkspaceDeletionContent />
    </DataSourceProvider>
  );
}

function WorkspaceDeletionContent() {
  const client = useAPIClient();
  const api = useMemo(() => new WorkspaceDeletionApi(client), [client]);
  const { flowEngine } = useApp();
  const { modal, message } = App.useApp();
  const navigate = useNavigate();
  const { canReadRuns, canReadShipments, canOpen, canDeleteRun, canDeleteShipment } = useWorkspaceDeletionPermissions();
  const screens = Grid.useBreakpoint();
  const columns = screens.xl ? 3 : screens.sm ? 2 : 1;
  const [runIds, setRunIds] = useState<Set<string>>(new Set());
  const [shipments, setShipments] = useState<Map<string, ShipmentSection>>(new Map());
  const [saving, setSaving] = useState(false);
  const loadRuns = useMemo(
    () => (canReadRuns ? (page: number) => api.runs(page, canReadShipments) : undefined),
    [api, canReadRuns, canReadShipments],
  );
  const loadShipments = useMemo(
    () => (canReadShipments ? (page: number) => api.standaloneShipments(page) : undefined),
    [api, canReadShipments],
  );
  const runs = useDeletionPage(loadRuns);
  const standalone = useDeletionPage(loadShipments);
  const total = runIds.size + shipments.size;
  const linkedCount = [...shipments.values()].filter((section) => section === 'linked').length;

  function goBack() {
    navigate(WORKSPACE_PATH);
  }

  function toggleRun(id: string, checked: boolean) {
    setRunIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleShipment(id: string, section: ShipmentSection, checked: boolean) {
    setShipments((current) => {
      const next = new Map(current);
      if (checked) next.set(id, section);
      else next.delete(id);
      return next;
    });
  }

  function confirmDeletion() {
    if (!total || saving) return;
    modal.confirm({
      title: 'Удалить выбранные записи?',
      content: `Рейсов: ${runIds.size}. Поставок: ${shipments.size}. Документы выбранных записей тоже будут удалены. Выбранные поставки исчезнут из всех связанных рейсов. Удаление необратимо.`,
      okText: 'Удалить',
      cancelText: 'Отмена',
      autoFocusButton: 'cancel',
      okButtonProps: { danger: true },
      async onOk() {
        setSaving(true);
        try {
          await api.remove([...runIds], [...shipments.keys()]);
          notifyWorkspaceChanged(flowEngine);
          message.success('Выбранные записи удалены.');
          goBack();
        } catch (error) {
          const detail = (error as { response?: { data?: { errors?: Array<{ message?: string }> } } }).response?.data
            ?.errors?.[0]?.message;
          message.error(detail || 'Не удалось удалить записи. Проверьте права или обновите список.');
          throw error;
        } finally {
          setSaving(false);
        }
      },
    });
  }

  function shipmentCheckbox(row: DeletionShipment, section: ShipmentSection) {
    return (
      <Checkbox
        aria-label={`Отметить поставку №${row.number}`}
        disabled={saving || !canDeleteShipment(row.id)}
        checked={shipments.has(row.id)}
        onChange={(event) => toggleShipment(row.id, section, event.target.checked)}
      />
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <Space align="baseline" wrap>
        <Button type="text" icon={<ArrowLeftOutlined />} disabled={saving} onClick={goBack}>
          Назад
        </Button>
        <Typography.Title level={2}>Удаление рейсов и поставок</Typography.Title>
      </Space>
      {!canOpen ? (
        <Alert type="warning" message="У вас нет права удалять рейсы или поставки." />
      ) : (
        <>
          {canReadRuns && (
            <SelectionSection
              title="Рейсы с поставками"
              count={`Выбрано — рейсов: ${runIds.size}, поставок: ${linkedCount}`}
              state={runs}
              columns={columns}
              renderCards={(rows) =>
                rows.map((run) => (
                  <Card key={run.id} size="small">
                    <Space align="start">
                      <Checkbox
                        aria-label={`Отметить рейс №${run.number}`}
                        disabled={saving || !canDeleteRun(run.id)}
                        checked={runIds.has(run.id)}
                        onChange={(event) => toggleRun(run.id, event.target.checked)}
                      />
                      <div style={{ overflowWrap: 'anywhere' }}>
                        <Typography.Text strong>Рейс №{run.number}</Typography.Text>
                        <div>
                          {run.transport} · {run.registration}
                        </div>
                        <div>Менеджеры — {run.managers}</div>
                        <div>Декларанты — {run.declarants}</div>
                      </div>
                    </Space>
                    {run.shipments.length ? (
                      <ul style={{ padding: 0, listStyle: 'none', marginBottom: 0, maxHeight: 224, overflowY: 'auto' }}>
                        {run.shipments.map((row) => (
                          <li key={row.id} style={{ marginBottom: 8 }}>
                            <Space align="start">
                              {shipmentCheckbox(row, 'linked')}
                              <ShipmentDetails shipment={row} />
                            </Space>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </Card>
                ))
              }
            />
          )}
          {canReadShipments && (
            <SelectionSection
              title="Поставки без рейса"
              count={`Выбрано — поставок: ${shipments.size - linkedCount}`}
              state={standalone}
              columns={columns}
              renderCards={(rows) =>
                rows.map((row) => (
                  <Card key={row.id} size="small">
                    <Space align="start">
                      {shipmentCheckbox(row, 'standalone')}
                      <ShipmentDetails shipment={row} />
                    </Space>
                  </Card>
                ))
              }
            />
          )}
          <Card size="small" style={{ position: 'sticky', bottom: 0, zIndex: 2, textAlign: 'right' }}>
            <Space>
              <Button disabled={saving} onClick={goBack}>
                Отмена
              </Button>
              <Button type="primary" danger disabled={!total} loading={saving} onClick={confirmDeletion}>
                Удалить выбранное ({total})
              </Button>
            </Space>
          </Card>
        </>
      )}
    </main>
  );
}
