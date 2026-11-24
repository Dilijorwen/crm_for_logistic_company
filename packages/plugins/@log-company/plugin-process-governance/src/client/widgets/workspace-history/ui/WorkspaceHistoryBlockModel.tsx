/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { TableBlockModel, useAPIClient } from '@nocobase/client';
import type { FlowEngine } from '@nocobase/flow-engine';
import { Alert, Empty, Table, type TableColumnsType } from 'antd';
import React, { useEffect, useState } from 'react';
import { LOGISTICS_HISTORY_EVENT_LABELS } from '../../../../shared/logistics';
import { LOGISTICS_RECORDS_CHANGED, workspaceAnchors } from '../../../shared/lib';
import { loadWorkspaceHistory, type WorkspaceHistoryEntry } from '../model/workspaceHistory';

const formatDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' });
const columns: TableColumnsType<WorkspaceHistoryEntry> = [
  { title: 'Запись', dataIndex: 'source', width: 140 },
  {
    title: 'Дата',
    dataIndex: 'createdAt',
    width: 155,
    render: (value: string) => (value ? formatDate.format(new Date(value)) : '—'),
  },
  { title: 'Автор', width: 145, render: (_, { createdBy }) => createdBy?.nickname || createdBy?.username || '—' },
  {
    title: 'Событие',
    dataIndex: 'event_type',
    width: 155,
    render: (value: string) =>
      LOGISTICS_HISTORY_EVENT_LABELS[value as keyof typeof LOGISTICS_HISTORY_EVENT_LABELS] ?? value,
  },
  { title: 'Поле', dataIndex: 'field_label', width: 175 },
  { title: 'Было', dataIndex: 'old_value' },
  { title: 'Стало', dataIndex: 'new_value' },
];

function WorkspaceHistory({ runId, engine }: { runId: string; engine: FlowEngine }) {
  const api = useAPIClient();
  const [entries, setEntries] = useState<WorkspaceHistoryEntry[]>();
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    engine.emitter.on(LOGISTICS_RECORDS_CHANGED, refresh);
    return () => {
      engine.emitter.off(LOGISTICS_RECORDS_CHANGED, refresh);
    };
  }, [engine]);

  useEffect(() => {
    let current = true;
    setError(false);
    loadWorkspaceHistory(api, runId)
      .then((rows) => {
        if (current) setEntries(rows);
      })
      .catch(() => {
        if (current) setError(true);
      });
    return () => {
      current = false;
    };
  }, [api, revision, runId]);

  if (error) return <Alert type="error" showIcon message="Не удалось загрузить историю рейса и поставок." />;
  return (
    <Table
      rowKey="key"
      size="small"
      columns={columns}
      dataSource={entries ?? []}
      loading={entries === undefined}
      locale={{ emptyText: 'История пока пуста' }}
      pagination={{ pageSize: 20, hideOnSinglePage: true }}
      scroll={{ x: 1000 }}
    />
  );
}

/** Keeps the existing history block and its settings in the NocoBase designer. */
export class LogisticsWorkspaceHistoryBlockModel extends TableBlockModel {
  renderComponent() {
    if (this.context.flowSettingsEnabled) return super.renderComponent();
    const { runId } = workspaceAnchors(this.context.view?.inputArgs);
    return runId ? (
      <WorkspaceHistory key={runId} runId={runId} engine={this.flowEngine} />
    ) : (
      <Empty description="Рейс не выбран" />
    );
  }
}

LogisticsWorkspaceHistoryBlockModel.define({ label: 'История рейса и поставок' });
