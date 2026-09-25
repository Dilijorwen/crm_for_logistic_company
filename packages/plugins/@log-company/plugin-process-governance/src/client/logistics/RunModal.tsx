/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Alert, Form, Input, Modal, Select, Tabs } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_LOGISTICS_STATUS, LOGISTICS_STATUS_LABELS, LOGISTICS_STATUS_VALUES } from '../../shared/logistics';
import { apiErrorMessage, isFormValidationError } from './apiResponse';
import { HistoryTable } from './HistoryTable';
import type { LogisticsService } from './LogisticsService';
import { RunShipmentsPanel } from './RunShipmentsPanel';
import type { LogisticsReferenceData, RunMutationInput, TransportRunRecord } from './types';
import type { LogisticsPermissions } from './useLogisticsPermissions';

interface RunFormValues {
  registrationNumber: string;
  status: string;
  departureCityId?: string;
  managerIds?: string[];
  declarantIds?: string[];
  parentRunIds?: string[];
}

interface RunModalProps {
  open: boolean;
  run: TransportRunRecord | null;
  runs: TransportRunRecord[];
  referenceData: LogisticsReferenceData;
  service: LogisticsService;
  permissions: LogisticsPermissions;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export function RunModal({ open, run, runs, referenceData, service, permissions, onClose, onChanged }: RunModalProps) {
  const [form] = Form.useForm<RunFormValues>();
  const [savedRun, setSavedRun] = useState<TransportRunRecord | null>(run);
  const [activeTab, setActiveTab] = useState('run');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSavedRun(run);
    setActiveTab('run');
    setError(null);
    form.setFieldsValue({
      registrationNumber: run?.registrationNumber,
      status: run?.status || DEFAULT_LOGISTICS_STATUS,
      departureCityId: run?.departureCity?.id,
      managerIds: run?.managers.map((item) => item.id) || [],
      declarantIds: run?.declarants.map((item) => item.id) || [],
      parentRunIds: run?.parentRuns.map((item) => item.id) || [],
    });
  }, [form, open, run]);

  const save = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      const input: RunMutationInput = {
        registrationNumber: values.registrationNumber,
        status: values.status,
        departureCityId: values.departureCityId || null,
        managerIds: values.managerIds || [],
        declarantIds: values.declarantIds || [],
        parentRunIds: values.parentRunIds || [],
      };
      setSaving(true);
      setError(null);
      if (savedRun) {
        await service.updateRun(savedRun.id, input);
        setSavedRun({
          ...savedRun,
          registrationNumber: input.registrationNumber,
          status: input.status,
          departureCity: referenceData.departureCities.find((item) => item.id === input.departureCityId) || null,
          managers: referenceData.users.filter((item) => input.managerIds.includes(item.id)),
          declarants: referenceData.users.filter((item) => input.declarantIds.includes(item.id)),
          parentRuns: runs
            .filter((item) => input.parentRunIds.includes(item.id))
            .map((item) => ({ id: item.id, label: String(item.runNumber) })),
        });
        setHistoryRevision((current) => current + 1);
      } else {
        const created = await service.createRun(input);
        setSavedRun({ ...created, registrationNumber: input.registrationNumber });
        setActiveTab('shipments');
      }
      await onChanged();
    } catch (reason) {
      if (isFormValidationError(reason)) {
        return;
      }
      setError(apiErrorMessage(reason, 'Не удалось сохранить рейс'));
    } finally {
      setSaving(false);
    }
  };

  const canSave = savedRun ? permissions.canUpdateRun(savedRun.id) : permissions.canCreateRun;
  const userOptions = referenceData.users.map((item) => ({ value: item.id, label: item.label }));
  const runOptions = useMemo(
    () =>
      runs
        .filter((item) => item.id !== savedRun?.id)
        .map((item) => ({ value: item.id, label: `№${item.runNumber} — ${item.registrationNumber}` })),
    [runs, savedRun?.id],
  );

  return (
    <Modal
      open={open}
      width={1050}
      title={savedRun ? `Рейс №${savedRun.runNumber}` : 'Новый рейс'}
      okText={savedRun ? 'Сохранить' : 'Создать и перейти к поставкам'}
      cancelText="Закрыть"
      confirmLoading={saving}
      okButtonProps={{ disabled: !canSave }}
      onOk={save}
      onCancel={onClose}
      destroyOnClose
    >
      {error ? <Alert type="error" showIcon message={error} className="lc-logistics-panel-alert" /> : null}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'run',
            label: 'Рейс',
            children: (
              <Form form={form} layout="vertical" disabled={!canSave} className="lc-logistics-run-form">
                <Form.Item
                  name="registrationNumber"
                  label="Номер машины"
                  extra="Допустимы латинские буквы и цифры. Пробелы и дефисы будут удалены, похожие русские буквы — приведены к латинским."
                  rules={[{ required: true, message: 'Укажите номер машины' }]}
                >
                  <Input autoComplete="off" maxLength={32} />
                </Form.Item>
                <Form.Item name="status" label="Статус">
                  <Select
                    options={LOGISTICS_STATUS_VALUES.map((value) => ({
                      value,
                      label: LOGISTICS_STATUS_LABELS[value],
                    }))}
                  />
                </Form.Item>
                <Form.Item name="departureCityId" label="Город отправления">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    options={referenceData.departureCities.map((item) => ({ value: item.id, label: item.label }))}
                  />
                </Form.Item>
                <Form.Item name="managerIds" label="Менеджеры">
                  <Select mode="multiple" allowClear showSearch optionFilterProp="label" options={userOptions} />
                </Form.Item>
                <Form.Item name="declarantIds" label="Декларанты">
                  <Select mode="multiple" allowClear showSearch optionFilterProp="label" options={userOptions} />
                </Form.Item>
                <Form.Item name="parentRunIds" label="Родительские рейсы">
                  <Select mode="multiple" allowClear showSearch optionFilterProp="label" options={runOptions} />
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'shipments',
            label: 'Поставки',
            disabled: !savedRun,
            children: savedRun ? (
              <RunShipmentsPanel
                runId={savedRun.id}
                referenceData={referenceData}
                service={service}
                canManageLinks={permissions.canUpdateRun(savedRun.id)}
                canCreateShipment={permissions.canCreateShipment}
                canUpdateShipment={permissions.canUpdateShipment}
                onChanged={onChanged}
              />
            ) : null,
          },
          {
            key: 'history',
            label: 'История',
            disabled: !savedRun,
            children: savedRun ? (
              <HistoryTable entityKind="run" entityId={savedRun.id} service={service} revision={historyRevision} />
            ) : null,
          },
        ]}
      />
    </Modal>
  );
}
