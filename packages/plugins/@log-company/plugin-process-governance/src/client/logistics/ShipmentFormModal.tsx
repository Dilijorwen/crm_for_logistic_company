/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Checkbox, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, Tabs } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { apiErrorMessage, isFormValidationError } from './apiResponse';
import { HistoryTable } from './HistoryTable';
import type { LogisticsService } from './LogisticsService';
import type { LogisticsReferenceData, ShipmentMutationInput, ShipmentRecord } from './types';

interface ShipmentFormValues {
  chineseClientId: string;
  companyId: string;
  routeDeliveryNumber?: string;
  invoiceNumber?: string;
  invoiceValue?: number;
  contractId?: string;
  customsScheme?: string;
  customsWarehouseId?: string;
  customsWarehouseStorageDate?: Dayjs;
  declarationNumber?: string;
  applicationNumber?: string;
  documentsInBadis?: boolean;
  customsPaymentsAmount?: number;
  ecoFee?: number;
  ktcAmount?: number;
  ntmCertificateGoods?: string;
  ntmSkkGoods?: string;
  ntmKfkGoods?: string;
  ntmHonestSignGoods?: string;
  ntmExportDeclarationRequired?: boolean;
  ntmHonestSignSum?: number;
  goodsCount?: number;
  enteredIn1c?: boolean;
  sentToClient?: boolean;
  declarationReleaseDate?: Dayjs;
  applicationReleaseDate?: Dayjs;
  additionalCheckResponseDeadline?: Dayjs;
  actualControl?: boolean;
  anosovDistributed?: boolean;
  managerComment?: string;
}

interface ShipmentFormModalProps {
  open: boolean;
  shipment: ShipmentRecord | null;
  referenceData: LogisticsReferenceData;
  service: LogisticsService;
  canSave: boolean;
  onClose: () => void;
  onSaved: (shipment: ShipmentRecord | null) => Promise<void>;
}

const FIELD_LABELS = {
  customsPaymentsAmount: 'Сумма таможенных платежей',
  ecoFee: 'Экологический сбор',
  ktcAmount: 'Сумма КТС',
  ntmHonestSignSum: 'Сумма «Честного знака» НТМ',
  declarationReleaseDate: 'Дата выпуска декларации',
  applicationReleaseDate: 'Дата выпуска заявления',
  additionalCheckResponseDeadline: 'Срок ответа по дополнительной проверке',
  documentsInBadis: 'Документы в БАДИС',
  enteredIn1c: 'Внесено в 1С',
  sentToClient: 'Отправлено клиенту',
  actualControl: 'Фактический контроль',
  anosovDistributed: 'Распределено Аносовым',
  ntmCertificateGoods: 'Товары для сертификата НТМ',
  ntmSkkGoods: 'Товары для СКК НТМ',
  ntmKfkGoods: 'Товары для КФК НТМ',
  ntmHonestSignGoods: 'Товары для «Честного знака» НТМ',
} as const;

function dateValue(value: string | null): Dayjs | undefined {
  return value ? dayjs(value) : undefined;
}

function dateString(value?: Dayjs): string | null {
  return value ? value.format('YYYY-MM-DD') : null;
}

export function ShipmentFormModal({
  open,
  shipment,
  referenceData,
  service,
  canSave,
  onClose,
  onSaved,
}: ShipmentFormModalProps) {
  const [form] = Form.useForm<ShipmentFormValues>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const selectedCompanyId = Form.useWatch('companyId', form);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    form.setFieldsValue({
      chineseClientId: shipment?.chineseClient?.id,
      companyId: shipment?.company?.id,
      routeDeliveryNumber: shipment?.routeDeliveryNumber,
      invoiceNumber: shipment?.invoiceNumber,
      invoiceValue: shipment?.invoiceValue ?? undefined,
      contractId: shipment?.contract?.id,
      customsScheme: shipment?.customsScheme,
      customsWarehouseId: shipment?.customsWarehouse?.id,
      customsWarehouseStorageDate: dateValue(shipment?.customsWarehouseStorageDate ?? null),
      declarationNumber: shipment?.declarationNumber,
      applicationNumber: shipment?.applicationNumber,
      documentsInBadis: shipment?.documentsInBadis ?? false,
      customsPaymentsAmount: shipment?.customsPaymentsAmount ?? undefined,
      ecoFee: shipment?.ecoFee ?? undefined,
      ktcAmount: shipment?.ktcAmount ?? undefined,
      ntmCertificateGoods: shipment?.ntmCertificateGoods,
      ntmSkkGoods: shipment?.ntmSkkGoods,
      ntmKfkGoods: shipment?.ntmKfkGoods,
      ntmHonestSignGoods: shipment?.ntmHonestSignGoods,
      ntmExportDeclarationRequired: shipment?.ntmExportDeclarationRequired ?? false,
      ntmHonestSignSum: shipment?.ntmHonestSignSum ?? undefined,
      goodsCount: shipment?.goodsCount ?? undefined,
      enteredIn1c: shipment?.enteredIn1c ?? false,
      sentToClient: shipment?.sentToClient ?? false,
      declarationReleaseDate: dateValue(shipment?.declarationReleaseDate ?? null),
      applicationReleaseDate: dateValue(shipment?.applicationReleaseDate ?? null),
      additionalCheckResponseDeadline: dateValue(shipment?.additionalCheckResponseDeadline ?? null),
      actualControl: shipment?.actualControl ?? false,
      anosovDistributed: shipment?.anosovDistributed ?? false,
      managerComment: shipment?.managerComment,
    });
  }, [form, open, shipment]);

  const options = useMemo(
    () => ({
      clients: referenceData.chineseClients.map((item) => ({ value: item.id, label: item.label })),
      companies: referenceData.companies.map((item) => ({ value: item.id, label: item.label })),
      contracts: referenceData.contracts
        .filter((item) => selectedCompanyId && item.companyIds.includes(selectedCompanyId))
        .map((item) => ({ value: item.id, label: item.label })),
      warehouses: referenceData.customsWarehouses.map((item) => ({ value: item.id, label: item.label })),
    }),
    [referenceData, selectedCompanyId],
  );

  const selectCompany = (companyId: string): void => {
    const contractId = form.getFieldValue('contractId');
    if (
      contractId &&
      !referenceData.contracts.some((contract) => contract.id === contractId && contract.companyIds.includes(companyId))
    ) {
      form.setFieldValue('contractId', undefined);
    }
  };

  const save = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      setError(null);
      const input: ShipmentMutationInput = {
        ...values,
        customsWarehouseStorageDate: dateString(values.customsWarehouseStorageDate),
        declarationReleaseDate: dateString(values.declarationReleaseDate),
        applicationReleaseDate: dateString(values.applicationReleaseDate),
        additionalCheckResponseDeadline: dateString(values.additionalCheckResponseDeadline),
      };
      if (shipment) {
        await service.updateShipment(shipment.id, input);
        setHistoryRevision((current) => current + 1);
        await onSaved(null);
      } else {
        await onSaved(await service.createShipment(input));
      }
    } catch (reason) {
      if (isFormValidationError(reason)) {
        return;
      }
      setError(apiErrorMessage(reason, 'Не удалось сохранить поставку'));
    } finally {
      setSaving(false);
    }
  };

  const generalFields = (
    <Row gutter={16}>
      <Col xs={24} md={12}>
        <Form.Item
          name="chineseClientId"
          label="Китайский клиент"
          rules={[{ required: true, message: 'Выберите китайского клиента' }]}
        >
          <Select showSearch optionFilterProp="label" options={options.clients} />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item
          name="companyId"
          label="Наша компания"
          rules={[{ required: true, message: 'Выберите нашу компанию' }]}
        >
          <Select showSearch optionFilterProp="label" options={options.companies} onChange={selectCompany} />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="routeDeliveryNumber" label="Номер доставки">
          <Input />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="contractId" label="Контракт">
          <Select
            allowClear
            showSearch
            disabled={!selectedCompanyId}
            optionFilterProp="label"
            options={options.contracts}
            notFoundContent={selectedCompanyId ? 'У компании нет доступных контрактов' : 'Сначала выберите компанию'}
          />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="invoiceNumber" label="Номер инвойса">
          <Input />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="invoiceValue" label="Стоимость по инвойсу">
          <InputNumber decimalSeparator="," min={0} precision={2} style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="customsScheme" label="Таможенная схема">
          <Select
            allowClear
            options={[
              { value: 'operator', label: 'Оператор' },
              { value: 'els', label: 'ЕЛС' },
            ]}
          />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="goodsCount" label="Количество товаров">
          <InputNumber decimalSeparator="," min={0} style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col span={24}>
        <Form.Item name="managerComment" label="Комментарий менеджера">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Col>
    </Row>
  );

  const customsFields = (
    <Row gutter={16}>
      <Col xs={24} md={12}>
        <Form.Item name="customsWarehouseId" label="СВХ">
          <Select allowClear showSearch optionFilterProp="label" options={options.warehouses} />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="customsWarehouseStorageDate" label="Дата размещения на СВХ">
          <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="declarationNumber" label="Номер декларации">
          <Input />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="applicationNumber" label="Номер заявления">
          <Input />
        </Form.Item>
      </Col>
      {(['customsPaymentsAmount', 'ecoFee', 'ktcAmount', 'ntmHonestSignSum'] as const).map((name) => (
        <Col xs={24} md={12} key={name}>
          <Form.Item name={name} label={FIELD_LABELS[name]}>
            <InputNumber decimalSeparator="," min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      ))}
      {(['declarationReleaseDate', 'applicationReleaseDate', 'additionalCheckResponseDeadline'] as const).map(
        (name) => (
          <Col xs={24} md={12} key={name}>
            <Form.Item name={name} label={FIELD_LABELS[name]}>
              <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        ),
      )}
      {(['documentsInBadis', 'enteredIn1c', 'sentToClient', 'actualControl', 'anosovDistributed'] as const).map(
        (name) => (
          <Col xs={24} md={12} key={name}>
            <Form.Item name={name} valuePropName="checked">
              <Checkbox>{FIELD_LABELS[name]}</Checkbox>
            </Form.Item>
          </Col>
        ),
      )}
    </Row>
  );

  const ntmFields = (
    <Row gutter={16}>
      {(['ntmCertificateGoods', 'ntmSkkGoods', 'ntmKfkGoods', 'ntmHonestSignGoods'] as const).map((name) => (
        <Col xs={24} md={12} key={name}>
          <Form.Item name={name} label={FIELD_LABELS[name]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Col>
      ))}
      <Col span={24}>
        <Form.Item name="ntmExportDeclarationRequired" valuePropName="checked">
          <Checkbox>Требуется экспортная декларация НТМ</Checkbox>
        </Form.Item>
      </Col>
    </Row>
  );

  return (
    <Modal
      open={open}
      width={920}
      title={shipment ? shipment.displayName || `Поставка №${shipment.shipmentNumber}` : 'Новая поставка'}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={saving}
      okButtonProps={{ disabled: !canSave }}
      onOk={save}
      onCancel={onClose}
      destroyOnClose
    >
      {error ? <div className="lc-logistics-error">{error}</div> : null}
      <Form form={form} layout="vertical" disabled={!canSave}>
        <Tabs
          items={[
            { key: 'general', label: 'Основное', children: generalFields },
            { key: 'customs', label: 'Оформление', children: customsFields },
            { key: 'ntm', label: 'НТМ', children: ntmFields },
            ...(shipment
              ? [
                  {
                    key: 'history',
                    label: 'История',
                    children: (
                      <HistoryTable
                        entityKind="shipment"
                        entityId={shipment.id}
                        service={service}
                        revision={historyRevision}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Form>
    </Modal>
  );
}
