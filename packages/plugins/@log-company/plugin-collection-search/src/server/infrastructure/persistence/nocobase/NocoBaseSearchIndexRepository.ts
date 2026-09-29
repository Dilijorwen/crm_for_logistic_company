/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createHash } from 'node:crypto';
import { Model, type Collection, type Database, type Field, type Transaction } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { buildSearchDocument } from '../../../domain/search/SearchDocument';
import type {
  CollectionSearchDescriptor,
  RecordKeyValues,
  SearchRelationDescriptor,
} from '../../../application/ports/CollectionSearchGateway';

const DOCUMENTS_COLLECTION = 'lc_collection_search_documents';
const STATES_COLLECTION = 'lc_collection_search_states';
const INDEX_CHUNK_SIZE = 500;
const INDEX_SCHEMA_VERSION = 3;
const EXCLUDED_FIELD_INTERFACES = new Set(['attachment', 'file', 'password', 'sequence', 'snowflakeId', 'sort']);

interface SearchStateRow {
  schemaSignature: string;
  status: string;
}

interface TransactionOptions {
  transaction?: Transaction;
}

export interface DependentSourceRecord {
  collectionName: string;
  keyValues: RecordKeyValues;
}

interface IndexedCollectionRegistration {
  descriptor: CollectionSearchDescriptor;
  database: Database;
  collection: Collection;
}

interface RegisteredDataSource {
  collectionManager: {
    db?: Database;
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function rawModelValue(value: unknown): unknown {
  if (value instanceof Model) {
    return modelValues(value);
  }
  if (Array.isArray(value)) {
    return value.map(rawModelValue);
  }
  return value;
}

function modelValues(model: Model): Record<string, unknown> {
  const values = asRecord(model.get());
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, rawModelValue(value)]));
}

export function serializeRecordKey(values: RecordKeyValues): string {
  return JSON.stringify(
    Object.keys(values)
      .sort()
      .reduce<RecordKeyValues>((result, key) => {
        result[key] = values[key];
        return result;
      }, {}),
  );
}

export function recordKeyValues(record: Record<string, unknown>, keyFields: string[]): RecordKeyValues | null {
  const values: RecordKeyValues = {};
  for (const field of keyFields) {
    const value = record[field];
    if (value === undefined || value === null || (typeof value === 'object' && typeof value !== 'boolean')) {
      return null;
    }
    values[field] = value as string | number | boolean;
  }
  return values;
}

function schemaSignature(descriptor: CollectionSearchDescriptor): string {
  const payload = {
    indexSchemaVersion: INDEX_SCHEMA_VERSION,
    keyFields: descriptor.keyFields,
    titleField: descriptor.titleField,
    fields: descriptor.searchableFields.map((field) => ({
      name: field.name,
      kind: field.kind,
      path: field.path,
      enum: field.enum,
    })),
    relations: descriptor.relations,
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function sourceFields(descriptor: CollectionSearchDescriptor): string[] {
  return Array.from(
    new Set([
      ...descriptor.keyFields,
      ...descriptor.searchableFields
        .filter((field) => !field.path || field.path.length === 1)
        .map((field) => field.name),
      ...(descriptor.titleField ? [descriptor.titleField] : []),
    ]),
  );
}

function sourceAppends(descriptor: CollectionSearchDescriptor): string[] {
  return descriptor.relations.map((relation) => relation.fieldName);
}

export class NocoBaseSearchIndexRepository {
  private readonly indexedCollections = new Set<string>();
  private readonly synchronization = new Map<string, Promise<void>>();
  private readonly registrations = new Map<string, IndexedCollectionRegistration>();

  constructor(private readonly plugin: Plugin) {}

  async loadReadyStates(): Promise<void> {
    const stateCollection = this.plugin.db.getCollection(STATES_COLLECTION);
    if (!stateCollection) {
      return;
    }
    const rows = await this.plugin.db.getRepository(STATES_COLLECTION).find({
      filter: { status: 'ready' },
      fields: ['dataSourceKey', 'collectionName'],
    });
    for (const row of rows) {
      const dataSourceKey = String(row.get('dataSourceKey'));
      const collectionName = String(row.get('collectionName'));
      const key = this.collectionKey(dataSourceKey, collectionName);
      this.indexedCollections.add(key);
      const dataSource = this.plugin.app.dataSourceManager.get(dataSourceKey) as RegisteredDataSource | undefined;
      const database = dataSource?.collectionManager.db;
      const collection = database?.getCollection(collectionName);
      if (!database || !collection) {
        continue;
      }
      const descriptor = describeCollection(collection, dataSourceKey);
      if (descriptor) {
        this.registrations.set(key, { descriptor, database, collection });
      }
    }
  }

  isEnabled(dataSourceKey: string, collectionName: string): boolean {
    return this.indexedCollections.has(this.collectionKey(dataSourceKey, collectionName));
  }

  async ensureSynchronized(
    descriptor: CollectionSearchDescriptor,
    sourceDatabase: Database,
    sourceCollection: Collection,
  ): Promise<void> {
    const key = this.collectionKey(descriptor.dataSourceKey, descriptor.collectionName);
    this.registrations.set(key, { descriptor, database: sourceDatabase, collection: sourceCollection });
    const existing = this.synchronization.get(key);
    if (existing) {
      await existing;
      return;
    }
    const synchronization = this.synchronize(descriptor, sourceDatabase, sourceCollection);
    this.synchronization.set(key, synchronization);
    try {
      await synchronization;
    } finally {
      this.synchronization.delete(key);
    }
  }

  async collectDependentSourceRecords(
    dataSourceKey: string,
    changedCollection: Collection,
    changedModel: Model,
    options: TransactionOptions,
  ): Promise<DependentSourceRecord[]> {
    const changedValues = modelValues(changedModel);
    const records = new Map<string, DependentSourceRecord>();
    for (const registration of this.registrations.values()) {
      if (registration.descriptor.dataSourceKey !== dataSourceKey || registration.database !== changedCollection.db) {
        continue;
      }
      for (const relation of registration.descriptor.relations) {
        if (relation.targetCollectionName === changedCollection.name) {
          const targetValue = changedValues[relation.targetKey];
          if (targetValue === undefined || targetValue === null) {
            continue;
          }
          const sourceModels = await registration.database.getRepository(registration.collection.name).find({
            filter: { [`${relation.fieldName}.${relation.targetKey}`]: targetValue },
            fields: registration.descriptor.keyFields,
            transaction: options.transaction,
          });
          for (const sourceModel of sourceModels) {
            this.addDependentRecord(records, registration, modelValues(sourceModel));
          }
        }
        if (relation.throughCollectionName === changedCollection.name && relation.throughSourceKey) {
          const sourceValue = changedValues[relation.throughSourceKey];
          if (sourceValue === undefined || sourceValue === null) {
            continue;
          }
          const sourceModels = await registration.database.getRepository(registration.collection.name).find({
            filter: { [relation.sourceKey]: sourceValue },
            fields: registration.descriptor.keyFields,
            transaction: options.transaction,
          });
          for (const sourceModel of sourceModels) {
            this.addDependentRecord(records, registration, modelValues(sourceModel));
          }
        }
      }
    }
    return Array.from(records.values());
  }

  async refreshDependentSourceRecords(
    dataSourceKey: string,
    records: DependentSourceRecord[],
    options: TransactionOptions,
  ): Promise<void> {
    for (const record of records) {
      const registration = this.registrations.get(this.collectionKey(dataSourceKey, record.collectionName));
      if (!registration) {
        continue;
      }
      const sourceModel = await registration.database.getRepository(record.collectionName).findOne({
        filter: record.keyValues,
        fields: sourceFields(registration.descriptor),
        appends: sourceAppends(registration.descriptor),
        transaction: options.transaction,
      });
      if (!sourceModel) {
        continue;
      }
      const values = this.documentValues(registration.descriptor, modelValues(sourceModel));
      if (values) {
        await this.documentsModel().upsert(values, {
          transaction: registration.database === this.plugin.db ? options.transaction : undefined,
          conflictFields: ['dataSourceKey', 'collectionName', 'recordKey'],
        });
      }
    }
  }

  async refreshDependentsOfChangedModel(
    dataSourceKey: string,
    changedCollection: Collection,
    changedModel: Model,
    options: TransactionOptions,
  ): Promise<void> {
    const records = await this.collectDependentSourceRecords(dataSourceKey, changedCollection, changedModel, options);
    await this.refreshDependentSourceRecords(dataSourceKey, records, options);
  }

  async upsertSourceModel(
    dataSourceKey: string,
    sourceCollection: Collection,
    model: Model,
    options: TransactionOptions,
  ): Promise<void> {
    await this.waitForSynchronization(dataSourceKey, sourceCollection.name);
    if (!this.isEnabled(dataSourceKey, sourceCollection.name)) {
      return;
    }
    const descriptor = describeCollection(sourceCollection, dataSourceKey);
    if (!descriptor) {
      return;
    }
    const keys = recordKeyValues(modelValues(model), descriptor.keyFields);
    if (!keys) {
      return;
    }
    const sourceModel = await sourceCollection.db.getRepository(sourceCollection.name).findOne({
      filter: keys,
      fields: sourceFields(descriptor),
      appends: sourceAppends(descriptor),
      transaction: options.transaction,
    });
    if (!sourceModel) {
      return;
    }
    const values = this.documentValues(descriptor, modelValues(sourceModel));
    if (!values) {
      return;
    }
    await this.documentsModel().upsert(values, {
      transaction: sourceCollection.db === this.plugin.db ? options.transaction : undefined,
      conflictFields: ['dataSourceKey', 'collectionName', 'recordKey'],
    });
  }

  async removeSourceModel(
    dataSourceKey: string,
    sourceCollection: Collection,
    model: Model,
    options: TransactionOptions,
  ): Promise<void> {
    await this.waitForSynchronization(dataSourceKey, sourceCollection.name);
    if (!this.isEnabled(dataSourceKey, sourceCollection.name)) {
      return;
    }
    const descriptor = describeCollection(sourceCollection, dataSourceKey);
    if (!descriptor) {
      return;
    }
    const keys = recordKeyValues(modelValues(model), descriptor.keyFields);
    if (!keys) {
      return;
    }
    await this.documentsModel().destroy({
      where: {
        dataSourceKey,
        collectionName: sourceCollection.name,
        recordKey: serializeRecordKey(keys),
      },
      transaction: sourceCollection.db === this.plugin.db ? options.transaction : undefined,
    });
  }

  private async synchronize(
    descriptor: CollectionSearchDescriptor,
    sourceDatabase: Database,
    sourceCollection: Collection,
  ): Promise<void> {
    const signature = schemaSignature(descriptor);
    const state = (await this.plugin.db.getRepository(STATES_COLLECTION).findOne({
      filter: {
        dataSourceKey: descriptor.dataSourceKey,
        collectionName: descriptor.collectionName,
      },
      fields: ['schemaSignature', 'status'],
    })) as Model | null;
    const stateValues = state?.toJSON() as unknown as SearchStateRow | undefined;
    if (stateValues?.status === 'ready' && stateValues.schemaSignature === signature) {
      this.indexedCollections.add(this.collectionKey(descriptor.dataSourceKey, descriptor.collectionName));
      return;
    }

    await this.writeState(descriptor, signature, 'building');
    try {
      await this.documentsModel().destroy({
        where: {
          dataSourceKey: descriptor.dataSourceKey,
          collectionName: descriptor.collectionName,
        },
      });
      const sourceRepository = sourceDatabase.getRepository(descriptor.collectionName);
      const indexModels = async (models: Model[]) => {
        const documents = models
          .map((model) => this.documentValues(descriptor, modelValues(model)))
          .filter((value): value is Record<string, unknown> => Boolean(value));
        if (documents.length) {
          await this.documentsModel().bulkCreate(documents);
        }
      };
      const query = {
        fields: sourceFields(descriptor),
        appends: sourceAppends(descriptor),
      };
      if (sourceDatabase.sequelize.getDialect() === 'sqlite') {
        let offset = 0;
        let models: Model[];
        do {
          models = await sourceRepository.find({ ...query, offset, limit: INDEX_CHUNK_SIZE });
          await indexModels(models);
          offset += INDEX_CHUNK_SIZE;
        } while (models.length === INDEX_CHUNK_SIZE);
      } else {
        await sourceRepository.chunkWithCursor({
          ...query,
          chunkSize: INDEX_CHUNK_SIZE,
          callback: indexModels,
        });
      }
      await this.writeState(descriptor, signature, 'ready', new Date());
      this.indexedCollections.add(this.collectionKey(descriptor.dataSourceKey, descriptor.collectionName));
    } catch (error) {
      this.indexedCollections.delete(this.collectionKey(descriptor.dataSourceKey, descriptor.collectionName));
      await this.writeState(
        descriptor,
        signature,
        'failed',
        undefined,
        error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000),
      );
      throw error;
    }
  }

  private documentValues(
    descriptor: CollectionSearchDescriptor,
    record: Record<string, unknown>,
  ): Record<string, unknown> | null {
    const keys = recordKeyValues(record, descriptor.keyFields);
    if (!keys) {
      return null;
    }
    const document = buildSearchDocument(record, descriptor.searchableFields);
    return {
      dataSourceKey: descriptor.dataSourceKey,
      collectionName: descriptor.collectionName,
      recordKey: serializeRecordKey(keys),
      keyValues: keys,
      fieldValues: document.values,
      searchText: document.searchText,
    };
  }

  private async writeState(
    descriptor: CollectionSearchDescriptor,
    signature: string,
    status: 'building' | 'ready' | 'failed',
    indexedAt?: Date,
    errorMessage?: string,
  ): Promise<void> {
    await this.statesModel().upsert(
      {
        dataSourceKey: descriptor.dataSourceKey,
        collectionName: descriptor.collectionName,
        schemaSignature: signature,
        status,
        indexedAt: indexedAt || null,
        errorMessage: errorMessage || null,
      },
      {
        conflictFields: ['dataSourceKey', 'collectionName'],
      },
    );
  }

  private documentsModel() {
    return this.plugin.db.getCollection(DOCUMENTS_COLLECTION).model;
  }

  private statesModel() {
    return this.plugin.db.getCollection(STATES_COLLECTION).model;
  }

  private collectionKey(dataSourceKey: string, collectionName: string): string {
    return `${dataSourceKey}:${collectionName}`;
  }

  private addDependentRecord(
    records: Map<string, DependentSourceRecord>,
    registration: IndexedCollectionRegistration,
    values: Record<string, unknown>,
  ): void {
    const keyValues = recordKeyValues(values, registration.descriptor.keyFields);
    if (!keyValues) {
      return;
    }
    const record = { collectionName: registration.collection.name, keyValues };
    records.set(`${record.collectionName}:${serializeRecordKey(keyValues)}`, record);
  }

  private async waitForSynchronization(dataSourceKey: string, collectionName: string): Promise<void> {
    const synchronization = this.synchronization.get(this.collectionKey(dataSourceKey, collectionName));
    if (synchronization) {
      await synchronization;
    }
  }
}

const SEARCHABLE_FIELD_TYPES = new Map<string, 'text' | 'number' | 'date' | 'boolean'>([
  ['string', 'text'],
  ['text', 'text'],
  ['uid', 'text'],
  ['nanoid', 'text'],
  ['uuid', 'text'],
  ['integer', 'number'],
  ['bigInt', 'number'],
  ['float', 'number'],
  ['double', 'number'],
  ['real', 'number'],
  ['decimal', 'number'],
  ['date', 'date'],
  ['dateOnly', 'date'],
  ['datetime', 'date'],
  ['datetimeTz', 'date'],
  ['datetimeNoTz', 'date'],
  ['time', 'date'],
  ['unixTimestamp', 'date'],
  ['boolean', 'boolean'],
]);

function enumItems(options: Record<string, unknown>) {
  const uiSchema = asRecord(options.uiSchema);
  const values = uiSchema.enum;
  if (!Array.isArray(values)) {
    return undefined;
  }
  return values
    .map((item) => {
      const option = asRecord(item);
      const value = option.value;
      if (value === undefined || (typeof value === 'object' && value !== null)) {
        return null;
      }
      return {
        value: (value ?? null) as string | number | boolean | null,
        label: String(option.label ?? value ?? ''),
      };
    })
    .filter((item): item is { value: string | number | boolean | null; label: string } => Boolean(item));
}

function searchableField(field: Field) {
  const options = asRecord(field.options);
  const kind = SEARCHABLE_FIELD_TYPES.get(field.type);
  if (
    !kind ||
    field.isRelationField() ||
    options.primaryKey === true ||
    options.isForeignKey === true ||
    EXCLUDED_FIELD_INTERFACES.has(String(options.interface || ''))
  ) {
    return null;
  }
  const uiSchema = asRecord(options.uiSchema);
  return {
    name: field.name,
    title: String(uiSchema.title || field.name),
    kind,
    enum: enumItems(options),
  };
}

function relationDescriptor(
  collection: Collection,
  field: Field,
): {
  field: NonNullable<ReturnType<typeof searchableField>> & { path: string[] };
  relation: SearchRelationDescriptor;
} | null {
  if (!field.isRelationField()) {
    return null;
  }
  const options = asRecord(field.options);
  if (EXCLUDED_FIELD_INTERFACES.has(String(options.interface || ''))) {
    return null;
  }
  const targetCollectionName = typeof options.target === 'string' ? options.target : undefined;
  if (!targetCollectionName || !collection.db) {
    return null;
  }
  const targetCollection = collection.db.getCollection(targetCollectionName);
  const targetOptions = asRecord(targetCollection?.options);
  const titleFieldName = typeof targetOptions.titleField === 'string' ? targetOptions.titleField : undefined;
  const titleField = titleFieldName ? targetCollection?.getField(titleFieldName) : undefined;
  if (!targetCollection || !titleField || titleField.isRelationField()) {
    return null;
  }
  const titleFieldOptions = asRecord(titleField.options);
  const kind = SEARCHABLE_FIELD_TYPES.get(titleField.type);
  if (!kind || EXCLUDED_FIELD_INTERFACES.has(String(titleFieldOptions.interface || ''))) {
    return null;
  }
  const collectionTargetKey = Array.isArray(collection.filterTargetKey)
    ? collection.filterTargetKey[0]
    : collection.filterTargetKey;
  const relatedTargetKey = Array.isArray(targetCollection.filterTargetKey)
    ? targetCollection.filterTargetKey[0]
    : targetCollection.filterTargetKey;
  const sourceKey = typeof options.sourceKey === 'string' ? options.sourceKey : collectionTargetKey;
  const targetKey = typeof options.targetKey === 'string' ? options.targetKey : relatedTargetKey;
  if (!sourceKey || !targetKey) {
    return null;
  }
  const uiSchema = asRecord(options.uiSchema);
  const throughCollectionName = typeof options.through === 'string' ? options.through : undefined;
  const throughSourceKey = typeof options.foreignKey === 'string' ? options.foreignKey : undefined;
  return {
    field: {
      name: field.name,
      title: String(uiSchema.title || field.name),
      kind,
      path: [field.name, titleFieldName],
      enum: enumItems(titleFieldOptions),
    },
    relation: {
      fieldName: field.name,
      targetCollectionName,
      targetKey,
      sourceKey,
      associationType: field.type,
      throughCollectionName,
      throughSourceKey,
    },
  };
}

export function describeCollection(collection: Collection, dataSourceKey: string): CollectionSearchDescriptor | null {
  const keyFields = Array.isArray(collection.filterTargetKey)
    ? collection.filterTargetKey
    : collection.filterTargetKey
      ? [collection.filterTargetKey]
      : [];
  if (!keyFields.length) {
    return null;
  }
  const scalarFields = collection
    .getFields()
    .map(searchableField)
    .filter((field): field is NonNullable<ReturnType<typeof searchableField>> => Boolean(field));
  const relationFields = collection
    .getFields()
    .map((field) => relationDescriptor(collection, field))
    .filter((item): item is NonNullable<ReturnType<typeof relationDescriptor>> => Boolean(item));
  const options = asRecord(collection.options);
  return {
    dataSourceKey,
    collectionName: collection.name,
    collectionTitle: String(options.title || collection.name),
    keyFields,
    titleField: typeof options.titleField === 'string' ? options.titleField : undefined,
    searchableFields: [...scalarFields, ...relationFields.map((item) => item.field)],
    relations: relationFields.map((item) => item.relation),
  };
}
