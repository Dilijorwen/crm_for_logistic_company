/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { LOGISTICS_COLLECTIONS } from '../../shared/logistics';
import { logisticsAssociationFields } from '../infrastructure/metadata/LogisticsAssociationFields';

const CUSTOMS_CLEARANCE_ROUTE_UID = '50grjmakocx';
const LEGACY_MENU_TITLE = '@log-company/plugin-process-governance.logisticsMenuTitle';

const COLLECTION_METADATA = [
  { name: LOGISTICS_COLLECTIONS.runs, title: 'Рейсы', hidden: false },
  { name: LOGISTICS_COLLECTIONS.shipments, title: 'Поставки', hidden: false },
  { name: LOGISTICS_COLLECTIONS.runHistory, title: 'История рейсов', hidden: false },
  { name: LOGISTICS_COLLECTIONS.shipmentHistory, title: 'История поставок', hidden: false },
  { name: LOGISTICS_COLLECTIONS.vehicles, title: 'Транспортные средства', hidden: true },
  { name: LOGISTICS_COLLECTIONS.shipmentComments, title: 'Комментарии к поставкам', hidden: true },
] as const;

interface MetadataRecord {
  get(key: string): unknown;
}

interface MetadataRepository {
  findOne(options: { filter: Record<string, unknown> }): Promise<MetadataRecord | null>;
  update(options: { filter: Record<string, unknown>; values: Record<string, unknown> }): Promise<unknown>;
}

interface RuntimeField {
  options?: {
    name?: string;
    uiSchema?: Record<string, unknown>;
  };
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.updateCollectionMetadata();
    await this.updateStaticFieldMetadata();
    await this.updateAssociationFieldMetadata();
    await this.replaceLegacyMenuTitle();
    await this.replaceLegacyHistoryLabels();
  }

  async down(): Promise<void> {
    // Russian metadata and the visibility boundary are intentionally preserved.
  }

  private async updateCollectionMetadata(): Promise<void> {
    const repository = this.db.getRepository('collections') as unknown as MetadataRepository;
    for (const metadata of COLLECTION_METADATA) {
      await repository.update({
        filter: { name: metadata.name },
        values: { title: metadata.title, hidden: metadata.hidden },
      });
    }
  }

  private async updateStaticFieldMetadata(): Promise<void> {
    for (const metadata of COLLECTION_METADATA) {
      const collection = this.db.getCollection(metadata.name);
      if (!collection) {
        continue;
      }
      for (const field of collection.getFields() as RuntimeField[]) {
        const name = field.options?.name;
        const uiSchema = field.options?.uiSchema;
        if (name && uiSchema) {
          await this.updateFieldUiSchema(metadata.name, name, uiSchema);
        }
      }
    }
  }

  private async updateAssociationFieldMetadata(): Promise<void> {
    for (const definition of logisticsAssociationFields) {
      const name = String(definition.field.name);
      const uiSchema = this.asRecord(definition.field.uiSchema);
      await this.updateFieldUiSchema(definition.collectionName, name, uiSchema);
    }
  }

  private async updateFieldUiSchema(
    collectionName: string,
    name: string,
    sourceUiSchema: Record<string, unknown>,
  ): Promise<void> {
    const repository = this.db.getRepository('fields') as unknown as MetadataRepository;
    const record = await repository.findOne({ filter: { collectionName, name } });
    if (!record) {
      return;
    }
    await repository.update({
      filter: { collectionName, name },
      values: { uiSchema: { ...this.asRecord(record.get('uiSchema')), ...sourceUiSchema } },
    });
  }

  private async replaceLegacyMenuTitle(): Promise<void> {
    const repository = this.db.getRepository('desktopRoutes') as unknown as MetadataRepository;
    const route = await repository.findOne({ filter: { schemaUid: CUSTOMS_CLEARANCE_ROUTE_UID } });
    if (route?.get('title') !== LEGACY_MENU_TITLE) {
      return;
    }
    await repository.update({
      filter: { schemaUid: CUSTOMS_CLEARANCE_ROUTE_UID },
      values: { title: 'Таможенное оформление' },
    });
  }

  private async replaceLegacyHistoryLabels(): Promise<void> {
    await this.replaceHistoryLabels(LOGISTICS_COLLECTIONS.runs, LOGISTICS_COLLECTIONS.runHistory);
    await this.replaceHistoryLabels(LOGISTICS_COLLECTIONS.shipments, LOGISTICS_COLLECTIONS.shipmentHistory);
  }

  private async replaceHistoryLabels(entityCollection: string, historyCollection: string): Promise<void> {
    const collection = this.db.getCollection(entityCollection);
    if (!collection) {
      return;
    }
    for (const field of collection.getFields() as RuntimeField[]) {
      const fieldName = field.options?.name;
      const title = field.options?.uiSchema?.title;
      if (!fieldName || typeof title !== 'string' || title.startsWith('{{t(')) {
        continue;
      }
      await this.db.sequelize.query(
        `UPDATE ${historyCollection}
         SET field_label = :title
         WHERE field_name = :fieldName AND field_label LIKE '{{t(%'`,
        { replacements: { fieldName, title } },
      );
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
