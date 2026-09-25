/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createMockDatabase, type Database } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CaptureLogisticsSnapshot } from '../../../application/logistics/CaptureLogisticsSnapshot';
import { LogisticsSnapshotStore } from '../../../application/logistics/LogisticsSnapshotStore';
import { NormalizeShipmentNumericFields } from '../../../application/logistics/NormalizeShipmentNumericFields';
import { RecordLogisticsCreated } from '../../../application/logistics/RecordLogisticsCreated';
import { RecordLogisticsFieldChanges } from '../../../application/logistics/RecordLogisticsFieldChanges';
import { RecordLogisticsRelationChange } from '../../../application/logistics/RecordLogisticsRelationChange';
import { RefreshShipmentDisplayName } from '../../../application/logistics/RefreshShipmentDisplayName';
import { WriteLogisticsHistory } from '../../../application/logistics/WriteLogisticsHistory';
import { logisticsReverseShipmentAssociationFields } from '../../../infrastructure/metadata/LogisticsAssociationFields';
import { NocoBaseLogisticsRepository } from '../../../infrastructure/persistence/nocobase/NocoBaseLogisticsRepository';
import { LogisticsHooks, type LogisticsHookActions } from '../LogisticsHooks';

interface HistoryRow {
  event_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
}

function historyFields(entityForeignKey: string) {
  return [
    { type: 'string', name: entityForeignKey, allowNull: false },
    { type: 'string', name: 'event_type', allowNull: false },
    { type: 'string', name: 'field_name' },
    { type: 'string', name: 'field_label' },
    { type: 'text', name: 'old_value' },
    { type: 'text', name: 'new_value' },
  ];
}

function reverseShipmentField(collectionName: string) {
  const definition = logisticsReverseShipmentAssociationFields.find((item) => item.collectionName === collectionName);
  if (!definition) {
    throw new Error(`Reverse shipment field is not defined for ${collectionName}.`);
  }
  return definition.field;
}

function registerCollections(db: Database): void {
  db.collection({
    name: 'transport_run_shipments',
    timestamps: false,
  });
  db.collection({
    name: 'vehicles',
    titleField: 'registration_number',
    fields: [{ type: 'string', name: 'registration_number' }],
  });
  db.collection({
    name: 'departure_cities',
    titleField: 'name',
    fields: [{ type: 'string', name: 'name' }],
  });
  db.collection({
    name: 'chinese_clients',
    titleField: 'name',
    fields: [{ type: 'string', name: 'name' }, reverseShipmentField('chinese_clients')],
  });
  db.collection({
    name: 'our_companies',
    titleField: 'name',
    fields: [{ type: 'string', name: 'name' }, reverseShipmentField('our_companies')],
  });
  db.collection({
    name: 'transport_runs',
    fields: [
      { type: 'integer', name: 'run_number' },
      {
        type: 'string',
        name: 'status',
        uiSchema: {
          title: 'Статус',
          enum: [
            { value: 'queue', label: 'В очереди' },
            { value: 'in_work', label: 'В работе' },
          ],
        },
      },
      { type: 'integer', name: 'vehicle_id', isForeignKey: true },
      {
        type: 'belongsTo',
        name: 'vehicle',
        target: 'vehicles',
        foreignKey: 'vehicle_id',
        uiSchema: { title: 'Транспортное средство' },
      },
      { type: 'virtual', name: 'registration_number_input' },
      { type: 'integer', name: 'departure_city_id', isForeignKey: true },
      {
        type: 'belongsTo',
        name: 'departure_city',
        target: 'departure_cities',
        foreignKey: 'departure_city_id',
        uiSchema: { title: 'Город отправления' },
      },
      {
        type: 'belongsToMany',
        name: 'shipments',
        target: 'shipments',
        through: 'transport_run_shipments',
        foreignKey: 'transport_run_id',
        otherKey: 'shipment_id',
      },
    ],
  });
  db.collection({
    name: 'shipments',
    fields: [
      { type: 'integer', name: 'shipment_number' },
      { type: 'string', name: 'display_name' },
      { type: 'integer', name: 'chinese_client_id', isForeignKey: true },
      {
        type: 'belongsTo',
        name: 'chinese_client',
        target: 'chinese_clients',
        foreignKey: 'chinese_client_id',
        uiSchema: { title: 'Китайский клиент' },
      },
      { type: 'integer', name: 'company_id', isForeignKey: true },
      {
        type: 'belongsTo',
        name: 'company',
        target: 'our_companies',
        foreignKey: 'company_id',
        uiSchema: { title: 'Наша компания' },
      },
      { type: 'string', name: 'invoice_number', uiSchema: { title: 'Номер инвойса' } },
      { type: 'string', name: 'application_number', uiSchema: { title: 'Номер заявления' } },
      { type: 'string', name: 'declaration_number', uiSchema: { title: 'Номер декларации' } },
      { type: 'double', name: 'invoice_value', uiSchema: { title: 'Стоимость по инвойсу' } },
      { type: 'boolean', name: 'documents_in_badis', uiSchema: { title: 'Документы в БАДИС' } },
    ],
  });
  db.collection({
    name: 'transport_run_history',
    createdAt: true,
    fields: historyFields('transport_run_id'),
  });
  db.collection({
    name: 'shipment_history',
    createdAt: true,
    fields: historyFields('shipment_id'),
  });
}

async function historyRows(db: Database, collection: string, filter: Record<string, unknown>): Promise<HistoryRow[]> {
  const records = await db.getRepository(collection).find({ filter, sort: ['createdAt', 'id'] });
  return records.map((record) => record.toJSON() as HistoryRow);
}

describe('Logistics history database integration', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createMockDatabase();
    await db.clean({ drop: true });
    registerCollections(db);
    await db.sync();
  });

  afterEach(async () => {
    await db.close();
  });

  it('persists complete field history for both runs and shipments', async () => {
    const plugin = { db } as Plugin;
    const repository = new NocoBaseLogisticsRepository(plugin);
    const logger = { warn: vi.fn(), error: vi.fn() };
    const snapshots = new LogisticsSnapshotStore();
    const history = new WriteLogisticsHistory(repository, logger);
    let nextNumber = 0;
    const vehicle = await db.getRepository('vehicles').create({ values: { registration_number: 'AB123CD' } });
    const firstCity = await db.getRepository('departure_cities').create({ values: { name: 'Суйфэньхэ' } });
    const secondCity = await db.getRepository('departure_cities').create({ values: { name: 'Хуньчунь' } });
    const client = await db.getRepository('chinese_clients').create({ values: { name: 'Клиент' } });
    const firstCompany = await db.getRepository('our_companies').create({ values: { name: 'Компания' } });
    const secondCompany = await db.getRepository('our_companies').create({ values: { name: 'Компания' } });
    const actions = {
      assignNumber: {
        execute: vi.fn(async (input: { isNewRecord: boolean; currentNumber: unknown }) =>
          input.isNewRecord ? ++nextNumber : input.currentNumber,
        ),
      },
      resolveRunVehicle: {
        execute: vi.fn(async () => ({ vehicleId: vehicle.get('id'), registrationNumber: 'AB123CD' })),
      },
      captureSnapshot: new CaptureLogisticsSnapshot(repository, snapshots, logger),
      normalizeShipmentNumericFields: new NormalizeShipmentNumericFields(),
      recordCreated: new RecordLogisticsCreated(repository, history, logger),
      recordFieldChanges: new RecordLogisticsFieldChanges(repository, snapshots, history, logger),
      recordRelationChange: new RecordLogisticsRelationChange(repository, history),
      validateRunParents: { execute: vi.fn(async () => undefined) },
      validateShipmentContract: { execute: vi.fn(async () => undefined) },
      validateShipmentDeletion: { execute: vi.fn(async () => undefined) },
      refreshShipmentDisplayName: new RefreshShipmentDisplayName(repository),
    } as unknown as LogisticsHookActions;
    new LogisticsHooks(plugin, repository, actions).register();

    const run = await db.getRepository('transport_runs').create({
      values: {
        registration_number_input: 'AB123CD',
        status: 'queue',
        departure_city_id: firstCity.get('id'),
      },
    });
    await db.getRepository('transport_runs').update({
      filterByTk: run.get('id'),
      values: { status: 'in_work', departure_city: { id: secondCity.get('id') } },
    });

    const shipment = await db.getRepository('shipments').create({
      values: {
        chinese_client_id: client.get('id'),
        company_id: firstCompany.get('id'),
        invoice_number: 'INV-OLD',
        application_number: 'ЗВ-OLD',
        invoice_value: '1,0',
        documents_in_badis: false,
      },
    });
    const createdShipment = await db.getRepository('shipments').findOne({ filterByTk: shipment.get('id') });
    expect(createdShipment?.get('invoice_value')).toBe(1);
    expect(createdShipment?.get('display_name')).toBe(
      `${String(shipment.get('shipment_number'))}/Клиент/INV-OLD/ЗВ-OLD/—`,
    );
    const clientShipments = await db.getRepository('chinese_clients.shipments', client.get('id')).find();
    const companyShipments = await db.getRepository('our_companies.shipments', firstCompany.get('id')).find();
    expect(clientShipments.map((record) => record.get('id'))).toEqual([shipment.get('id')]);
    expect(companyShipments.map((record) => record.get('id'))).toEqual([shipment.get('id')]);
    await db.getRepository('shipments').update({
      filterByTk: shipment.get('id'),
      values: {
        company: { id: secondCompany.get('id') },
        invoice_number: 'INV-NEW',
        declaration_number: 'ДТ-NEW',
        invoice_value: '2.5',
        documents_in_badis: true,
      },
    });
    const updatedShipment = await db.getRepository('shipments').findOne({ filterByTk: shipment.get('id') });
    expect(updatedShipment?.get('invoice_value')).toBe(2.5);
    expect(updatedShipment?.get('display_name')).toBe(
      `${String(shipment.get('shipment_number'))}/Клиент/INV-NEW/ЗВ-OLD/ДТ-NEW`,
    );

    const relatedShipment = await db.getRepository('transport_runs.shipments', run.get('id')).create({
      values: {
        chinese_client: client.get('id'),
        company: firstCompany.get('id'),
        invoice_number: 'INV-MANAGER',
        application_number: 'ЗВ-MANAGER',
      },
      whitelist: ['chinese_client', 'company', 'invoice_number', 'application_number'],
    });
    const persistedRelatedShipment = await db
      .getRepository('shipments')
      .findOne({ filterByTk: relatedShipment.get('id') });
    expect(persistedRelatedShipment?.get('display_name')).toBe(
      `${String(relatedShipment.get('shipment_number'))}/Клиент/INV-MANAGER/ЗВ-MANAGER/—`,
    );
    expect(await historyRows(db, 'shipment_history', { shipment_id: relatedShipment.get('id') })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: 'field_initialized',
          field_name: 'invoice_number',
          new_value: 'INV-MANAGER',
        }),
      ]),
    );

    const runHistory = await historyRows(db, 'transport_run_history', { transport_run_id: run.get('id') });
    const shipmentHistory = await historyRows(db, 'shipment_history', { shipment_id: shipment.get('id') });
    expect(runHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event_type: 'field_initialized', field_name: 'status', new_value: 'В очереди' }),
        expect.objectContaining({ event_type: 'field_initialized', field_name: 'vehicle', new_value: 'AB123CD' }),
        expect.objectContaining({
          event_type: 'field_changed',
          field_name: 'status',
          old_value: 'В очереди',
          new_value: 'В работе',
        }),
        expect.objectContaining({
          event_type: 'field_changed',
          field_name: 'departure_city',
          old_value: 'Суйфэньхэ',
          new_value: 'Хуньчунь',
        }),
      ]),
    );
    expect(shipmentHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: 'field_initialized',
          field_name: 'invoice_number',
          new_value: 'INV-OLD',
        }),
        expect.objectContaining({
          event_type: 'field_initialized',
          field_name: 'invoice_value',
          new_value: '1',
        }),
        expect.objectContaining({
          event_type: 'field_initialized',
          field_name: 'documents_in_badis',
          new_value: 'false',
        }),
        expect.objectContaining({
          event_type: 'field_changed',
          field_name: 'invoice_number',
          old_value: 'INV-OLD',
          new_value: 'INV-NEW',
        }),
        expect.objectContaining({
          event_type: 'field_changed',
          field_name: 'invoice_value',
          old_value: '1',
          new_value: '2.5',
        }),
        expect.objectContaining({
          event_type: 'field_changed',
          field_name: 'documents_in_badis',
          old_value: 'false',
          new_value: 'true',
        }),
        expect.objectContaining({
          event_type: 'field_changed',
          field_name: 'company',
          old_value: `Компания (ID: ${String(firstCompany.get('id'))})`,
          new_value: `Компания (ID: ${String(secondCompany.get('id'))})`,
        }),
      ]),
    );
  });
});
