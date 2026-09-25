/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { logisticsReverseShipmentAssociationFields } from '../../infrastructure/metadata/LogisticsAssociationFields';
import { logisticsSystemFields } from '../../infrastructure/metadata/LogisticsSystemFields';
import shipmentComments from '../shipmentComments';
import shipmentHistory from '../shipmentHistory';
import shipments from '../shipments';
import transportRunHistory from '../transportRunHistory';
import transportRuns from '../transportRuns';
import vehicles from '../vehicles';

const primaryCollections = [transportRuns, shipments, transportRunHistory, shipmentHistory];
const supportCollections = [vehicles, shipmentComments];

function collectInterfaceText(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectInterfaceText);
  }
  if (value === null || typeof value !== 'object') {
    return [];
  }
  return Object.values(value as Record<string, unknown>).flatMap(collectInterfaceText);
}

describe('logistics collection metadata', () => {
  it('keeps the four primary collections visible in the NocoBase designer', () => {
    expect(primaryCollections.map((collection) => [collection.name, collection.title, collection.hidden])).toEqual([
      ['transport_runs', 'Рейсы', false],
      ['shipments', 'Поставки', false],
      ['transport_run_history', 'История рейсов', false],
      ['shipment_history', 'История поставок', false],
    ]);
  });

  it('hides support collections from the designer', () => {
    expect(supportCollections.map((collection) => [collection.name, collection.hidden])).toEqual([
      ['vehicles', true],
      ['shipment_comments', true],
    ]);
  });

  it('uses direct Russian labels without i18n expressions', () => {
    const interfaceText = [...primaryCollections, ...supportCollections].flatMap(collectInterfaceText);
    expect(interfaceText.some((value) => value.includes('{{t('))).toBe(false);
    expect(interfaceText).toContain('Номер машины');
    expect(interfaceText).toContain('Название поставки');
    expect(interfaceText).toContain('Начальное значение');
    expect(interfaceText).toContain('Добавлен родительский рейс');
    expect(interfaceText).toContain('Добавлен дочерний рейс');
  });

  it('uses the computed shipment title and hides the technical vehicle relation', () => {
    expect(shipments.titleField).toBe('display_name');
    expect(transportRuns.fields.find((field) => field.name === 'vehicle')?.hidden).toBe(true);
    expect(transportRuns.fields.find((field) => field.name === 'vehicle_id')?.hidden).toBe(true);
  });

  it('does not require users to select a run status and keeps the queue default', () => {
    const status = transportRuns.fields.find((field) => field.name === 'status');

    expect(status).toMatchObject({ allowNull: false, defaultValue: 'queue' });
    expect(status?.validation).toBeUndefined();
    expect(status?.uiSchema?.required).toBeUndefined();
  });

  it('accepts a comma or a dot in every double shipment field', () => {
    const doubleFields = shipments.fields.filter((field) => field.type === 'double');
    expect(doubleFields).toHaveLength(6);
    for (const field of doubleFields) {
      expect(field.uiSchema?.['x-component-props']).toEqual(expect.objectContaining({ decimalSeparator: ',' }));
    }
  });

  it('exposes reverse shipment relations for companies and Chinese clients', () => {
    expect(logisticsReverseShipmentAssociationFields).toEqual([
      expect.objectContaining({
        collectionName: 'chinese_clients',
        field: expect.objectContaining({
          name: 'shipments',
          type: 'hasMany',
          target: 'shipments',
          foreignKey: 'chinese_client_id',
        }),
      }),
      expect.objectContaining({
        collectionName: 'our_companies',
        field: expect.objectContaining({
          name: 'shipments',
          type: 'hasMany',
          target: 'shipments',
          foreignKey: 'company_id',
        }),
      }),
    ]);
  });

  it('registers Russian timestamp fields for mutable and append-only logistics collections', () => {
    expect(logisticsSystemFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionName: 'transport_runs',
          field: expect.objectContaining({ name: 'createdAt', interface: 'createdAt' }),
        }),
        expect.objectContaining({
          collectionName: 'transport_runs',
          field: expect.objectContaining({ name: 'updatedAt', interface: 'updatedAt' }),
        }),
        expect.objectContaining({
          collectionName: 'shipment_history',
          field: expect.objectContaining({ name: 'createdAt', interface: 'createdAt' }),
        }),
      ]),
    );
    expect(
      logisticsSystemFields.some(
        (definition) => definition.collectionName === 'shipment_history' && definition.field.name === 'updatedAt',
      ),
    ).toBe(false);
    expect(collectInterfaceText(logisticsSystemFields).some((value) => value.includes('{{t('))).toBe(false);
  });
});
