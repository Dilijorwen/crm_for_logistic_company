/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { SubFormListFieldModel } from '@nocobase/client';
import { DisconnectOutlined, DownOutlined, PlusOutlined } from '@ant-design/icons';
import type { FlowModel } from '@nocobase/flow-engine';
import { Button, Collapse, Dropdown, Form, Space, Tabs, Typography, theme, type FormInstance } from 'antd';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { WORKSPACE_DETACHED_SHIPMENT_IDS_FIELD, WORKSPACE_SHIPMENT_DOCUMENTS } from '../../../../shared/workspace';
import { DEFAULT_LOGISTICS_STATUS, SHIPMENT_REFERENCE_FIELDS } from '../../../../shared/logistics';
import { LogisticsWorkspaceShipmentFieldsGridModel } from './WorkspaceShipmentFieldsGridModel';
import { rememberSelectedShipments, setShipmentSelectionPending } from './unifiedShipmentSave';
import { ScopedNativeBlock } from '../../scoped-native-block';

interface ShipmentRow extends Record<string, unknown> {
  id?: string | number;
  workspaceDraftKey?: string;
  shipment_number?: string | number;
  __is_stored__?: boolean;
}

function WorkspaceShipmentSubform({
  model,
  nativeFields,
}: {
  model: LogisticsWorkspaceShipmentSubformModel;
  nativeFields: React.ReactElement;
}) {
  const form = model.context.form;
  const name = model.props.name;
  const shipmentPath = Array.isArray(name) ? name : [name];
  const watched: unknown = Form.useWatch(name, { form, preserve: true });
  const [activeKey, setActiveKey] = useState<string>();
  const nextDraft = useRef(0);
  const draftBindings = useRef(
    new Map<string, { form: FormInstance; companyPath(): (string | number)[]; setTokens(tokens: string[]): void }>(),
  );
  const fieldsRef = useRef<HTMLDivElement>(null);
  const { token } = theme.useToken();
  const value: unknown = watched ?? form.getFieldValue(name);
  const rows = (Array.isArray(value) ? value : []) as ShipmentRow[];
  const items = rows.map((row, index) => ({
    key: row?.id == null ? row.workspaceDraftKey ?? `new-${index}` : String(row.id),
    label: row?.shipment_number == null ? `Новая поставка ${index + 1}` : `№${row.shipment_number}`,
  }));
  const selected = items.findIndex((item) => item.key === activeKey);
  const index = selected === -1 ? 0 : selected;
  const shipmentId = rows[index]?.id;
  useLayoutEffect(() => {
    const body = fieldsRef.current?.querySelector(':scope > .ant-card > .ant-card-body');
    if (!body) return;
    // Keep NocoBase's row wrappers and their validation registered while switching tabs.
    Array.from(body.children)
      .slice(0, rows.length)
      .forEach((row, rowIndex) => {
        row.toggleAttribute('hidden', rowIndex !== index);
      });
  }, [index, rows.length, nativeFields]);
  if (model.context.flowSettingsEnabled) return nativeFields;
  const canCreate = Boolean(model.props.allowCreate && model.props.allowAddNew);
  const canAssociate = Boolean(model.props.allowSelectExistingRecord);
  function addShipment() {
    const workspaceDraftKey = `draft-${++nextDraft.current}`;
    setActiveKey(workspaceDraftKey);
    model.props.onChange([...rows, { __is_new__: true, status: DEFAULT_LOGISTICS_STATUS, workspaceDraftKey }]);
  }
  async function detachShipment() {
    if (shipmentId != null) {
      const number = rows[index].shipment_number;
      const confirmed = await model.context.modal.confirm({
        title: number == null ? 'Отвязать поставку от рейса?' : `Отвязать поставку №${number} от рейса?`,
        content: 'Связь будет снята после сохранения рейса.',
        okText: 'Отвязать',
        cancelText: 'Отмена',
        autoFocusButton: 'cancel',
      });
      if (!confirmed) return;
    }
    if (shipmentId != null && !rows[index].__is_stored__ && model.context.view?.inputArgs?.filterByTk) {
      const previous: string[] = form.getFieldValue(WORKSPACE_DETACHED_SHIPMENT_IDS_FIELD) ?? [];
      form.setFieldValue(WORKSPACE_DETACHED_SHIPMENT_IDS_FIELD, [...new Set([...previous, String(shipmentId)])]);
    }
    const remaining = rows.filter((_, rowIndex) => rowIndex !== index);
    const nextIndex = Math.min(index, remaining.length - 1);
    const next = remaining[nextIndex];
    const removedDraft = rows[index].workspaceDraftKey;
    if (removedDraft) draftBindings.current.delete(removedDraft);
    setActiveKey(next && (next.id == null ? next.workspaceDraftKey ?? `new-${nextIndex}` : String(next.id)));
    model.props.onChange(remaining);
  }
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Space wrap>
        {(canCreate || canAssociate) && (
          <Dropdown
            trigger={['click']}
            disabled={model.props.disabled || model.props.workspaceSelectionPending}
            menu={{
              items: [
                { key: 'create', label: 'Создать новую поставку', disabled: !canCreate },
                { key: 'associate', label: 'Привязать существующую', disabled: !canAssociate },
              ],
              onClick: ({ key }) => (key === 'create' ? addShipment() : model.props.onSelectExitRecordClick()),
            }}
          >
            <Button icon={<PlusOutlined />} disabled={model.props.disabled}>
              Добавить поставку <DownOutlined />
            </Button>
          </Dropdown>
        )}
        {rows.length > 0 && (
          <Button
            icon={<DisconnectOutlined />}
            disabled={model.props.disabled}
            title={shipmentId != null ? 'Поставка будет отвязана при сохранении рейса' : undefined}
            onClick={detachShipment}
          >
            {shipmentId == null ? 'Убрать черновик' : 'Отвязать'}
          </Button>
        )}
      </Space>
      {rows.length ? (
        <>
          <Tabs items={items} activeKey={items[index].key} onChange={setActiveKey} />
          <div ref={fieldsRef}>
            {React.cloneElement(nativeFields, {
              allowAddNew: false,
              allowSelectExistingRecord: false,
              allowDisassociation: false,
              // The stock list reads this prop only for its per-row remove icon.
              // Form.List still gets the original rows from the form store.
              value: undefined,
            })}
          </div>
        </>
      ) : (
        <Typography.Text type="secondary">Поставок пока нет</Typography.Text>
      )}
      {rows.map((row, rowIndex) => {
        const key = row.workspaceDraftKey;
        if (row.id != null || !key) return null;
        let binding = draftBindings.current.get(key);
        if (!binding) {
          const indexOfDraft = () =>
            (form.getFieldValue(name) as ShipmentRow[] | undefined)?.findIndex(
              (item) => item.workspaceDraftKey === key,
            ) ?? -1;
          binding = {
            form,
            companyPath: () => [...shipmentPath, indexOfDraft(), 'company'],
            setTokens: (tokens) => {
              const draftIndex = indexOfDraft();
              if (draftIndex !== -1)
                form.setFieldValue([...shipmentPath, draftIndex, WORKSPACE_SHIPMENT_DOCUMENTS], tokens);
            },
          };
          draftBindings.current.set(key, binding);
        }
        return (
          <div key={key} hidden={rowIndex !== index} style={{ marginTop: token.marginSM }}>
            <ScopedNativeBlock host={model} templateUid="lcwspagedocs" shipmentDraft={binding} />
          </div>
        );
      })}
      {shipmentId != null && (
        <Space direction="vertical" size={token.marginSM} style={{ width: '100%', marginTop: token.marginSM }}>
          <ScopedNativeBlock key={shipmentId} host={model} templateUid="lcwspagedocs" shipmentId={String(shipmentId)} />
        </Space>
      )}
    </Space>
  );
}

/** The native subform owns inputs, selector, validation, ACL and the submit payload. */
export class LogisticsWorkspaceShipmentSubformModel extends SubFormListFieldModel {
  async change() {
    if (this.props.workspaceSelectionPending) return;
    const { resource, form, api } = this.context.blockModel.context;
    const name = this.props.name;
    const readRows = (): ShipmentRow[] => form.getFieldValue(name) ?? [];
    const known = new Set(readRows().flatMap(({ id }) => (id == null ? [] : [String(id)])));
    const selected: ShipmentRow[] = this.selectedRows.value;
    const ids = [...new Set(selected.flatMap(({ id }) => (id != null && !known.has(String(id)) ? [String(id)] : [])))];
    if (!ids.length) return;
    this.setProps('workspaceSelectionPending', true);
    setShipmentSelectionPending(resource, true);
    try {
      // Picker rows contain only the fields needed by its current columns.
      const records = await Promise.all(
        ids.map(async (id) => {
          const response = await api.request({
            url: 'shipments:get',
            method: 'get',
            params: { filterByTk: id, appends: [...SHIPMENT_REFERENCE_FIELDS] },
          });
          const record = response.data?.data as ShipmentRow | undefined;
          if (record?.id == null || String(record.id) !== id) throw new Error('Выбранная поставка недоступна.');
          return { ...record, __is_stored__: true };
        }),
      );
      const current = readRows();
      rememberSelectedShipments(resource, current, records);
      this.props.onChange([...current, ...records]);
    } catch {
      this.context.message.error('Не удалось загрузить данные выбранных поставок. Повторите выбор.');
    } finally {
      setShipmentSelectionPending(resource, false);
      this.setProps('workspaceSelectionPending', false);
    }
  }

  onMount() {
    const grid = this.subModels?.grid;
    const forks = grid && !Array.isArray(grid) ? grid.forks : undefined;
    // NocoBase 2.0.60 stores row models in a Set, while its rule action calls map().
    if (forks instanceof Set && !('map' in forks)) {
      Object.defineProperty(forks, 'map', {
        value: <Result,>(mapRow: (row: FlowModel) => Result) => Array.from(forks, mapRow),
      });
    }
    super.onMount();
  }

  render() {
    return <WorkspaceShipmentSubform model={this} nativeFields={super.render()} />;
  }
}

export class LogisticsWorkspaceShipmentFoldGridModel extends LogisticsWorkspaceShipmentFieldsGridModel {
  render() {
    const fields = super.render();
    if (this.context.flowSettingsEnabled) return fields;
    return (
      <Collapse
        ghost
        style={{ borderTop: `1px solid ${this.context.themeToken.colorBorderSecondary}` }}
        items={[{ key: 'fields', label: this.props.workspaceSectionTitle, children: fields, forceRender: true }]}
      />
    );
  }
}
