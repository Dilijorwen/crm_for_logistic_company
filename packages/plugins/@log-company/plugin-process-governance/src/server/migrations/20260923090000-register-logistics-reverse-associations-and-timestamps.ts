/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { logisticsReverseShipmentAssociationFields } from '../infrastructure/metadata/LogisticsAssociationFields';
import { logisticsSystemFields } from '../infrastructure/metadata/LogisticsSystemFields';

const LEGACY_PROCESS_COLLECTION = 'customs_processes';
const SHIPMENT_OWNER_COLLECTIONS = ['chinese_clients', 'our_companies'] as const;
const MANAGED_FIELDS = [...logisticsReverseShipmentAssociationFields, ...logisticsSystemFields] as const;

interface MetadataModel {
  get(name: string): unknown;
  update(values: Record<string, unknown>): Promise<unknown>;
}

interface CollectionsMetadataRepository {
  findOne(options: { filter: { name: string } }): Promise<unknown>;
}

interface FieldsMetadataRepository {
  find(options: { filter: { collectionName: { $in: readonly string[] } } }): Promise<MetadataModel[]>;
  findOne(options: { filter: { collectionName: string; name: string } }): Promise<MetadataModel | null>;
  create(options: { values: Record<string, unknown> }): Promise<unknown>;
  destroy(options: { filter: { collectionName: string; name: string } }): Promise<number>;
}

function isMetadataOptions(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const collections = this.db.getRepository('collections') as unknown as CollectionsMetadataRepository;
    const fields = this.db.getRepository('fields') as unknown as FieldsMetadataRepository;

    await this.assertCollectionsExist(collections);
    for (const definition of MANAGED_FIELDS) {
      await this.upsertField(fields, definition.collectionName, definition.field);
    }
    await this.removeLegacyProcessAssociations(fields);
  }

  async down(): Promise<void> {
    // Keep the corrected metadata because removing it would hide valid relations and timestamps again.
  }

  private async assertCollectionsExist(repository: CollectionsMetadataRepository): Promise<void> {
    const requiredCollections = new Set([
      'shipments',
      ...MANAGED_FIELDS.map((definition) => definition.collectionName),
    ]);
    for (const collectionName of requiredCollections) {
      const collection = await repository.findOne({ filter: { name: collectionName } });
      if (!collection) {
        throw new Error(`Для настройки логистических полей отсутствует коллекция ${collectionName}.`);
      }
    }
  }

  private async upsertField(
    repository: FieldsMetadataRepository,
    collectionName: string,
    field: Record<string, unknown>,
  ): Promise<void> {
    const { name, type, interface: fieldInterface, ...options } = field;
    const fieldName = String(name);
    const existing = await repository.findOne({ filter: { collectionName, name: fieldName } });
    if (!existing) {
      await repository.create({
        values: {
          collectionName,
          name: fieldName,
          type,
          interface: fieldInterface,
          ...options,
        },
      });
      return;
    }
    await existing.update({ type, interface: fieldInterface, options });
  }

  private async removeLegacyProcessAssociations(repository: FieldsMetadataRepository): Promise<void> {
    const candidates = await repository.find({
      filter: { collectionName: { $in: SHIPMENT_OWNER_COLLECTIONS } },
    });
    for (const candidate of candidates) {
      const options = candidate.get('options');
      if (!isMetadataOptions(options) || options.target !== LEGACY_PROCESS_COLLECTION) {
        continue;
      }
      const collectionName = candidate.get('collectionName');
      const name = candidate.get('name');
      if (typeof collectionName !== 'string' || typeof name !== 'string') {
        throw new Error('Некорректные метаданные устаревшей связи с таможенным оформлением.');
      }
      await repository.destroy({ filter: { collectionName, name } });
    }
  }
}
