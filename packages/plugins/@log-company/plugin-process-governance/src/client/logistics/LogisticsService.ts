/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';
import {
  asRecord,
  booleanValue,
  identifier,
  numberValue,
  recordArray,
  responseRecord,
  responseRecords,
  stringValue,
} from './apiResponse';
import type {
  ContractReferenceRecord,
  LogisticsHistoryRecord,
  LogisticsReferenceData,
  ReferenceRecord,
  RunMutationInput,
  ShipmentMutationInput,
  ShipmentRecord,
  TransportRunRecord,
} from './types';

const SHIPMENT_FIELDS = [
  'id',
  'shipment_number',
  'display_name',
  'route_delivery_number',
  'invoice_number',
  'invoice_value',
  'customs_scheme',
  'customs_warehouse_storage_date',
  'declaration_number',
  'application_number',
  'documents_in_badis',
  'customs_payments_amount',
  'eco_fee',
  'ktc_amount',
  'ntm_certificate_goods',
  'ntm_skk_goods',
  'ntm_kfk_goods',
  'ntm_honest_sign_goods',
  'ntm_export_declaration_required',
  'ntm_honest_sign_sum',
  'goods_count',
  'entered_in_1c',
  'sent_to_client',
  'declaration_release_date',
  'application_release_date',
  'additional_check_response_deadline',
  'actual_control',
  'anosov_distributed',
  'manager_comment',
] as const;

function reference(value: unknown, labelFields: string[]): ReferenceRecord | null {
  const record = asRecord(value);
  const id = identifier(record.id);
  if (!id) {
    return null;
  }
  const label = labelFields.map((field) => stringValue(record[field])).find(Boolean) || id;
  return { id, label };
}

function references(value: unknown, labelFields: string[]): ReferenceRecord[] {
  return recordArray(value)
    .map((record) => reference(record, labelFields))
    .filter((item): item is ReferenceRecord => item !== null);
}

function contractReference(value: unknown): ContractReferenceRecord | null {
  const record = asRecord(value);
  const item = reference(record, ['name']);
  if (!item) {
    return null;
  }
  return {
    ...item,
    companyIds: recordArray(record.importers)
      .map((company) => identifier(company.id))
      .filter(Boolean),
  };
}

export function normalizeShipment(value: Record<string, unknown>): ShipmentRecord {
  return {
    id: identifier(value.id),
    shipmentNumber: numberValue(value.shipment_number) ?? 0,
    displayName: stringValue(value.display_name),
    chineseClient: reference(value.chinese_client, ['name', 'title']),
    company: reference(value.company, ['name', 'title']),
    routeDeliveryNumber: stringValue(value.route_delivery_number),
    invoiceNumber: stringValue(value.invoice_number),
    invoiceValue: numberValue(value.invoice_value),
    contract: reference(value.contract_record, ['title', 'name']),
    customsScheme: stringValue(value.customs_scheme),
    customsWarehouse: reference(value.customs_warehouse, ['name', 'title']),
    customsWarehouseStorageDate: stringValue(value.customs_warehouse_storage_date) || null,
    declarationNumber: stringValue(value.declaration_number),
    applicationNumber: stringValue(value.application_number),
    documentsInBadis: booleanValue(value.documents_in_badis),
    customsPaymentsAmount: numberValue(value.customs_payments_amount),
    ecoFee: numberValue(value.eco_fee),
    ktcAmount: numberValue(value.ktc_amount),
    ntmCertificateGoods: stringValue(value.ntm_certificate_goods),
    ntmSkkGoods: stringValue(value.ntm_skk_goods),
    ntmKfkGoods: stringValue(value.ntm_kfk_goods),
    ntmHonestSignGoods: stringValue(value.ntm_honest_sign_goods),
    ntmExportDeclarationRequired: booleanValue(value.ntm_export_declaration_required),
    ntmHonestSignSum: numberValue(value.ntm_honest_sign_sum),
    goodsCount: numberValue(value.goods_count),
    enteredIn1c: booleanValue(value.entered_in_1c),
    sentToClient: booleanValue(value.sent_to_client),
    declarationReleaseDate: stringValue(value.declaration_release_date) || null,
    applicationReleaseDate: stringValue(value.application_release_date) || null,
    additionalCheckResponseDeadline: stringValue(value.additional_check_response_deadline) || null,
    actualControl: booleanValue(value.actual_control),
    anosovDistributed: booleanValue(value.anosov_distributed),
    managerComment: stringValue(value.manager_comment),
  };
}

export function normalizeRun(value: Record<string, unknown>): TransportRunRecord {
  const vehicle = asRecord(value.vehicle);
  return {
    id: identifier(value.id),
    runNumber: numberValue(value.run_number) ?? 0,
    status: stringValue(value.status),
    createdAt: stringValue(value.createdAt),
    registrationNumber: stringValue(value.registration_number_input) || stringValue(vehicle.registration_number),
    departureCity: reference(value.departure_city, ['name', 'title']),
    managers: references(value.managers, ['nickname', 'username']),
    declarants: references(value.declarants, ['nickname', 'username']),
    parentRuns: references(value.parent_runs, ['run_number']),
    shipments: recordArray(value.shipments).map(normalizeShipment),
  };
}

function association(id: string | null): { id: string } | null {
  return id ? { id } : null;
}

function associations(ids: string[]): Array<{ id: string }> {
  return ids.map((id) => ({ id }));
}

function shipmentValues(input: ShipmentMutationInput): Record<string, unknown> {
  return {
    chinese_client: association(input.chineseClientId),
    company: association(input.companyId),
    route_delivery_number: input.routeDeliveryNumber,
    invoice_number: input.invoiceNumber,
    invoice_value: input.invoiceValue,
    contract_record: association(input.contractId ?? null),
    customs_scheme: input.customsScheme,
    customs_warehouse: association(input.customsWarehouseId ?? null),
    customs_warehouse_storage_date: input.customsWarehouseStorageDate,
    declaration_number: input.declarationNumber,
    application_number: input.applicationNumber,
    documents_in_badis: input.documentsInBadis,
    customs_payments_amount: input.customsPaymentsAmount,
    eco_fee: input.ecoFee,
    ktc_amount: input.ktcAmount,
    ntm_certificate_goods: input.ntmCertificateGoods,
    ntm_skk_goods: input.ntmSkkGoods,
    ntm_kfk_goods: input.ntmKfkGoods,
    ntm_honest_sign_goods: input.ntmHonestSignGoods,
    ntm_export_declaration_required: input.ntmExportDeclarationRequired,
    ntm_honest_sign_sum: input.ntmHonestSignSum,
    goods_count: input.goodsCount,
    entered_in_1c: input.enteredIn1c,
    sent_to_client: input.sentToClient,
    declaration_release_date: input.declarationReleaseDate,
    application_release_date: input.applicationReleaseDate,
    additional_check_response_deadline: input.additionalCheckResponseDeadline,
    actual_control: input.actualControl,
    anosov_distributed: input.anosovDistributed,
    manager_comment: input.managerComment,
  };
}

export class LogisticsService {
  constructor(private readonly api: APIClient) {}

  async getRuns(): Promise<TransportRunRecord[]> {
    const response: unknown = await this.api.resource('transport_runs').list({
      paginate: false,
      sort: ['-run_number'],
      fields: ['id', 'run_number', 'status', 'createdAt', 'registration_number_input'],
      appends: ['vehicle', 'departure_city', 'managers', 'declarants', 'parent_runs', 'shipments'],
    });
    return responseRecords(response)
      .map(normalizeRun)
      .filter((item) => item.id);
  }

  async createRun(input: RunMutationInput): Promise<TransportRunRecord> {
    const response: unknown = await this.api.resource('transport_runs').create({ values: this.runValues(input) });
    return normalizeRun(responseRecord(response));
  }

  async updateRun(runId: string, input: RunMutationInput): Promise<void> {
    await this.api.resource('transport_runs').update({ filterByTk: runId, values: this.runValues(input) });
  }

  async deleteRun(runId: string): Promise<void> {
    await this.api.resource('transport_runs').destroy({ filterByTk: runId });
  }

  async getRunShipments(runId: string): Promise<ShipmentRecord[]> {
    const response: unknown = await this.api.resource('transport_runs.shipments', runId).list({
      paginate: false,
      sort: ['-shipment_number'],
      fields: [...SHIPMENT_FIELDS],
      appends: ['chinese_client', 'company', 'contract_record', 'customs_warehouse'],
    });
    return responseRecords(response)
      .map(normalizeShipment)
      .filter((item) => item.id);
  }

  async getAvailableShipments(): Promise<ShipmentRecord[]> {
    const response: unknown = await this.api.resource('shipments').list({
      paginate: false,
      sort: ['-shipment_number'],
      fields: [...SHIPMENT_FIELDS],
      appends: ['chinese_client', 'company', 'contract_record', 'customs_warehouse'],
    });
    return responseRecords(response)
      .map(normalizeShipment)
      .filter((item) => item.id);
  }

  async createShipment(input: ShipmentMutationInput): Promise<ShipmentRecord> {
    const response: unknown = await this.api.resource('shipments').create({ values: shipmentValues(input) });
    return normalizeShipment(responseRecord(response));
  }

  async updateShipment(shipmentId: string, input: ShipmentMutationInput): Promise<void> {
    await this.api.resource('shipments').update({ filterByTk: shipmentId, values: shipmentValues(input) });
  }

  async deleteShipment(shipmentId: string): Promise<void> {
    await this.api.resource('shipments').destroy({ filterByTk: shipmentId });
  }

  async attachShipments(runId: string, shipmentIds: string[]): Promise<void> {
    await this.api.resource('transport_runs.shipments', runId).add({ values: shipmentIds });
  }

  async detachShipment(runId: string, shipmentId: string): Promise<void> {
    await this.api.resource('transport_runs.shipments', runId).remove({ values: [shipmentId] });
  }

  async getRunHistory(runId: string): Promise<LogisticsHistoryRecord[]> {
    return this.getHistory('transport_run_history', { transport_run_id: runId });
  }

  async getShipmentHistory(shipmentId: string): Promise<LogisticsHistoryRecord[]> {
    return this.getHistory('shipment_history', { shipment_id: shipmentId });
  }

  async getReferenceData(): Promise<LogisticsReferenceData> {
    const [chineseClients, companies, contracts, customsWarehouses, departureCities, users] = await Promise.all([
      this.getReferences('chinese_clients', ['name']),
      this.getReferences('our_companies', ['name']),
      this.getContractReferences(),
      this.getReferences('customs_warehouses', ['name']),
      this.getReferences('departure_cities', ['name']),
      this.getReferences('users', ['nickname', 'username']),
    ]);
    return { chineseClients, companies, contracts, customsWarehouses, departureCities, users };
  }

  private runValues(input: RunMutationInput): Record<string, unknown> {
    return {
      registration_number_input: input.registrationNumber,
      status: input.status,
      departure_city: association(input.departureCityId),
      managers: associations(input.managerIds),
      declarants: associations(input.declarantIds),
      parent_runs: associations(input.parentRunIds),
    };
  }

  private async getHistory(resource: string, filter: Record<string, unknown>): Promise<LogisticsHistoryRecord[]> {
    const response: unknown = await this.api.resource(resource).list({
      paginate: false,
      filter,
      sort: ['-createdAt', '-id'],
      fields: ['id', 'event_type', 'field_name', 'field_label', 'old_value', 'new_value', 'createdAt'],
      appends: ['createdBy'],
    });
    return responseRecords(response).map((record) => {
      const createdBy = asRecord(record.createdBy);
      return {
        id: identifier(record.id),
        eventType: stringValue(record.event_type),
        fieldName: stringValue(record.field_name),
        fieldLabel: stringValue(record.field_label),
        oldValue: stringValue(record.old_value),
        newValue: stringValue(record.new_value),
        createdAt: stringValue(record.createdAt),
        createdBy: stringValue(createdBy.nickname) || stringValue(createdBy.username),
      };
    });
  }

  private async getReferences(resource: string, labelFields: string[]): Promise<ReferenceRecord[]> {
    const response: unknown = await this.api.resource(resource).list({
      paginate: false,
      sort: [labelFields[0], 'id'],
      fields: ['id', ...labelFields],
    });
    return responseRecords(response)
      .map((record) => reference(record, labelFields))
      .filter((item): item is ReferenceRecord => item !== null);
  }

  private async getContractReferences(): Promise<ContractReferenceRecord[]> {
    const response: unknown = await this.api.resource('contracts').list({
      paginate: false,
      sort: ['name', 'id'],
      fields: ['id', 'name'],
      appends: ['importers'],
    });
    return responseRecords(response)
      .map(contractReference)
      .filter((item): item is ContractReferenceRecord => item !== null);
  }
}
