/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useEffect, useState } from 'react';
import { Alert, App, Button, Form, Input, Popconfirm, Select, Space, Typography } from 'antd';
import { observer } from '@nocobase/flow-engine';
import type { TableTemplateHost } from '../model/TableTemplateHost';

export const FilterTemplatesToolbar = observer(({ model, isOpen }: { model: TableTemplateHost; isOpen: boolean }) => {
  const controller = model.templates;
  const state = controller.state;
  const identity = model.getPersonalizationIdentity();
  const identityKey = JSON.stringify(identity);
  const ownerKey = model.getPersonalizationOwner();
  const [mode, setMode] = useState<'create' | 'rename' | null>(null);
  const [form] = Form.useForm<{ name: string }>();
  const { message } = App.useApp();
  const current = controller.matches(identity, ownerKey) ? state.data : null;
  const selected = current?.templates.find((template) => template.id === state.selectedTemplateId);
  const isBusy = state.isLoading || state.isSaving || state.isApplying || model.isTemplateOperationBlocked();

  useEffect(() => {
    if (isOpen) controller.activate(model.getPersonalizationIdentity(), ownerKey);
  }, [controller, model, identityKey, ownerKey, isOpen]);

  useEffect(() => {
    setMode(null);
  }, [ownerKey, identityKey, isOpen]);

  function startCreate(): void {
    form.setFieldsValue({ name: '' });
    setMode('create');
  }

  function startRename(): void {
    if (!selected) return;
    form.setFieldsValue({ name: selected.name });
    setMode('rename');
  }

  async function saveName(values: { name: string }): Promise<void> {
    if (!mode || (mode === 'rename' && !selected)) return;
    const success =
      mode === 'rename' && selected
        ? await controller.mutate('rename', { id: selected.id, revision: selected.revision, name: values.name })
        : await controller.mutate('create', { name: values.name }, () => model.captureTemplateSnapshot());
    if (!success) return;
    if (mode === 'create')
      state.selectedTemplateId = state.data?.templates.find((template) => template.name === values.name.trim())?.id;
    message.success(mode === 'create' ? 'Шаблон сохранён' : 'Шаблон переименован');
    setMode(null);
  }

  async function update(): Promise<void> {
    if (
      selected &&
      (await controller.mutate('update', { id: selected.id, revision: selected.revision }, () =>
        model.captureTemplateSnapshot(),
      ))
    ) {
      message.success('Фильтр и настройки колонок в шаблоне обновлены');
    }
  }

  async function remove(): Promise<void> {
    if (selected && (await controller.mutate('delete', { id: selected.id, revision: selected.revision }))) {
      state.selectedTemplateId = undefined;
      message.success('Шаблон удалён');
    }
  }

  async function choose(id: string): Promise<void> {
    const template = current?.templates.find((value) => value.id === id);
    if (id && !template) return;
    setMode(null);
    await controller.apply(template?.id, () => model.applyTableTemplate(template));
  }

  return (
    <div style={{ width: 'min(520px, calc(100vw - 48px))' }}>
      <Space direction="vertical" style={{ display: 'flex' }}>
        <Typography.Text strong>Шаблоны таблицы</Typography.Text>
        {state.error && (
          <Alert
            type="error"
            showIcon
            message={state.error}
            action={
              <Button size="small" disabled={isBusy} onClick={() => controller.reload()}>
                Обновить список
              </Button>
            }
          />
        )}
        <Select
          aria-label="Шаблон таблицы"
          value={selected?.id || ''}
          options={[
            { value: '', label: 'Без шаблона' },
            ...(current?.templates || []).map((template) => ({ value: template.id, label: template.name })),
          ]}
          loading={state.isLoading || state.isApplying}
          disabled={!current || isBusy || Boolean(mode)}
          onSelect={choose}
          style={{ width: '100%' }}
          getPopupContainer={(trigger) => trigger.parentElement || trigger}
        />
        {current?.templates.length === 0 && (
          <Typography.Text type="secondary">Сохранённых шаблонов пока нет</Typography.Text>
        )}
        <Space wrap>
          <Button size="small" disabled={!current || isBusy || Boolean(mode)} onClick={startCreate}>
            Сохранить как новый
          </Button>
          {selected && (
            <>
              <Button size="small" disabled={isBusy || Boolean(mode)} onClick={update}>
                Обновить шаблон
              </Button>
              <Button size="small" disabled={isBusy || Boolean(mode)} onClick={startRename}>
                Переименовать
              </Button>
              <Popconfirm
                title="Удалить шаблон?"
                description="Текущий фильтр и колонки останутся в таблице."
                onConfirm={remove}
                okText="Удалить"
                cancelText="Отмена"
                okButtonProps={{ danger: true, loading: state.isSaving }}
                getPopupContainer={(trigger) => trigger.parentElement || trigger}
              >
                <Button size="small" danger disabled={isBusy || Boolean(mode)}>
                  Удалить
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
        {mode && (
          <Form form={form} layout="vertical" onFinish={saveName} disabled={isBusy}>
            <Form.Item
              label="Название шаблона"
              name="name"
              rules={[
                { required: true, whitespace: true, message: 'Введите название шаблона' },
                { max: 100, message: 'Не более 100 символов' },
              ]}
            >
              <Input autoFocus maxLength={100} />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={state.isSaving}>
                Сохранить
              </Button>
              <Button disabled={state.isSaving} onClick={() => setMode(null)}>
                Отмена
              </Button>
            </Space>
          </Form>
        )}
      </Space>
    </div>
  );
});
