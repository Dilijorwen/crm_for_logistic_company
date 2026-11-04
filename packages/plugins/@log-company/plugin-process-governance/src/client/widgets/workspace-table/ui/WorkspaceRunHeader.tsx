/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';
import { Button, Space, Typography } from 'antd';
import React from 'react';
import { TRANSPORT_TYPE_LABELS, type TransportType } from '../../../../shared/transport';
import { openWorkspaceRun, WorkspaceShipmentAddButton } from '../../../features/workspace-actions';
import type { WorkspaceRunGroup } from '../model/workspaceGroups';
import { useWorkspaceTable } from '../model/WorkspaceTableContext';

export function transportIcon(type: unknown): React.ReactNode {
  const paths =
    type === 'rail' ? (
      <>
        <rect x="6" y="2" width="12" height="16" rx="3" />
        <path d="M6 10h12M12 3v7M8 21l2-3m6 3-2-3" />
        <circle cx="9" cy="14" r=".6" />
        <circle cx="15" cy="14" r=".6" />
      </>
    ) : type === 'air' ? (
      <path d="m21 3-6 9 1 7-2 2-3-7-5 4-2-1 4-6-6-3 2-2 7 1 8-6Z" />
    ) : type === 'sea' ? (
      <>
        <path d="M3 13l9-4 9 4-3 6H6Zm4-2V6h10v5M10 6V3h4v3M2 21l3-1 3 1 4-1 4 1 3-1 3 1" />
      </>
    ) : (
      <>
        <path d="M2 5h12v12H2Zm12 5h4l4 4v3h-8M17 10v4h5" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>
    );
  return (
    <svg
      viewBox="0 0 24 24"
      width="1.25em"
      height="1.25em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

export function rowText(row: Record<string, unknown>, field: string, fallback = '—'): string {
  const value = row[field];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}

export function WorkspaceRunHeader({ group }: { group: WorkspaceRunGroup }) {
  const state = useWorkspaceTable();
  const { row } = group;
  const collapsed = state.collapsedRunIds.includes(group.id);
  const selected = state.selectedRunId === group.id;
  const type = row.transport_type as TransportType;
  const total = group.total;
  const open = () => openWorkspaceRun(state.table, group.id, row.id);
  return (
    <div className={`lc-workspace-run-group${selected ? ' is-selected' : ''}`}>
      <div
        className="lc-workspace-run-header"
        data-run-id={group.id}
        role="group"
        tabIndex={0}
        aria-label={`Выбрать рейс №${rowText(row, 'run_number')}`}
        onClick={(event) => {
          event.stopPropagation();
          state.selectRun(group.id);
        }}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            state.selectRun(group.id);
          }
        }}
      >
        <Button
          type="text"
          size="small"
          aria-label={`${collapsed ? 'Раскрыть' : 'Свернуть'} рейс №${rowText(row, 'run_number')}`}
          aria-expanded={!collapsed}
          icon={collapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
          onClick={(event) => {
            event.stopPropagation();
            state.toggleRun(group.id);
          }}
        />
        <span className="lc-workspace-transport-icon">{transportIcon(type)}</span>
        <div className="lc-workspace-run-title">
          <Space wrap size="small">
            <Typography.Link
              strong
              onClick={(event) => {
                event.stopPropagation();
                state.selectRun(group.id);
                return open();
              }}
            >
              Рейс №{rowText(row, 'run_number')}
            </Typography.Link>
            <Typography.Link
              onClick={(event) => {
                event.stopPropagation();
                state.selectRun(group.id);
                return open();
              }}
            >
              {rowText(row, 'registration_number')}
            </Typography.Link>
          </Space>
          <div className="lc-workspace-run-subtitle">
            <span>
              {TRANSPORT_TYPE_LABELS[type] || 'Тип не указан'} · {rowText(row, 'departure_city_name')}
            </span>
            <span>Менеджеры: {rowText(row, 'manager_names', 'Не назначены')}</span>
            <span>Декларанты: {rowText(row, 'declarant_names', 'Не назначены')}</span>
          </div>
        </div>
        <div className="lc-workspace-run-controls">
          <span className="lc-workspace-run-count">Поставок: {total}</span>
          <WorkspaceShipmentAddButton host={state.table} runId={group.id} rowId={row.id} compact />
        </div>
      </div>
    </div>
  );
}
