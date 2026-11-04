/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { BlockModel } from '@nocobase/client';
import { FlowModelRenderer, type FlowEngine, type FlowModel } from '@nocobase/flow-engine';
import { Alert, Button, Empty, Spin, Tabs } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LOGISTICS_RECORDS_CHANGED, workspaceAnchors } from '../../../shared/lib';
import { ScopedShipmentEditor } from './ScopedShipmentEditor';

interface ShipmentTab {
  id: string;
  shipmentNumber: number;
}

function WorkspaceShipments({ model, runId }: { model: LogisticsWorkspaceShipmentsBlockModel; runId: string }) {
  const requested = workspaceAnchors(model.context.view?.inputArgs).shipmentId;
  const [items, setItems] = useState<ShipmentTab[]>([]);
  const [selected, setSelected] = useState(requested || 'list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const editor = useRef<FlowEngine>();
  const generation = useRef(0);
  const onReady = useCallback((engine?: FlowEngine) => {
    editor.current = engine;
  }, []);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError(false);
    try {
      const response = await model.context.api
        .resource('transport_runs.shipments', runId)
        .list({ paginate: false, fields: ['id', 'shipment_number'], sort: ['shipment_number'] });
      if (current !== generation.current) return;
      const rows: unknown = response.data?.data;
      if (!Array.isArray(rows)) throw new Error('Invalid shipment list response');
      const shipments = rows.map((row: { id: string | number; shipment_number: number }) => ({
        id: String(row.id),
        shipmentNumber: row.shipment_number,
      }));
      setItems(shipments);
      setSelected((value) => (value === 'list' || shipments.some((item) => item.id === value) ? value : 'list'));
    } catch (failure) {
      console.error('Не удалось загрузить поставки рейса.', failure);
      if (current === generation.current) setError(true);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [model, runId]);
  const invalidateRequests = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    load();
    model.flowEngine.emitter.on(LOGISTICS_RECORDS_CHANGED, load);
    return () => {
      invalidateRequests();
      model.flowEngine.emitter.off(LOGISTICS_RECORDS_CHANGED, load);
    };
  }, [model, load, invalidateRequests]);
  async function changeTab(value: string) {
    if (value === selected) return;
    let dirty = false;
    editor.current?.forEachModel((candidate) => {
      const form = candidate as FlowModel & { getUserModifiedFields?(): Set<string> };
      if (form.getUserModifiedFields?.().size) dirty = true;
    });
    if (
      dirty &&
      !(await model.context.modal.confirm({
        title: 'Есть несохранённые изменения',
        content: 'Переключить поставку и отменить эти изменения?',
        okText: 'Переключить',
        cancelText: 'Остаться',
      }))
    )
      return;
    setSelected(value);
  }
  if (error)
    return (
      <Alert
        type="error"
        showIcon
        message="Не удалось загрузить поставки рейса"
        action={<Button onClick={load}>Повторить</Button>}
      />
    );
  const tabItems = [
    {
      key: 'list',
      label: 'Список',
      children: <FlowModelRenderer model={model.subModels?.list as FlowModel} showFlowSettings={false} />,
    },
    ...items.map((item) => ({
      key: item.id,
      label: `№${item.shipmentNumber}`,
      children:
        selected === item.id ? (
          <ScopedShipmentEditor
            key={`${runId}:${item.id}`}
            host={model}
            shipmentId={item.id}
            runId={runId}
            onReady={onReady}
          />
        ) : null,
    })),
  ];
  return (
    <Spin spinning={loading}>
      <Tabs activeKey={selected} onChange={changeTab} items={tabItems} />
      {!loading && !items.length ? (
        <Empty description="В рейсе пока нет поставок. Добавьте новую или выберите существующие на вкладке «Рейс»." />
      ) : null}
    </Spin>
  );
}

export class LogisticsWorkspaceShipmentsBlockModel extends BlockModel {
  onInit(options: unknown) {
    super.onInit(options);
    this.context.defineProperty('disableBlockGridPadding', { value: true });
  }

  render() {
    // This model supplies context/navigation; the native table supplies its own card.
    return this.props.pageOnly ? this.renderComponent() : super.render();
  }

  renderComponent() {
    const runId = workspaceAnchors(this.context.view?.inputArgs).runId;
    if (runId && this.props.pageOnly)
      return <FlowModelRenderer model={this.subModels?.list as FlowModel} showFlowSettings={true} />;
    return runId ? (
      <WorkspaceShipments key={runId} model={this} runId={runId} />
    ) : (
      <Empty description="Рейс не выбран" />
    );
  }
}
LogisticsWorkspaceShipmentsBlockModel.define({ label: 'Поставки рейса по номерам' });
