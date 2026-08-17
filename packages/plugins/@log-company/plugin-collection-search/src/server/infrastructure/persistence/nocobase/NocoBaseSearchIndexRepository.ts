/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createHash } from 'node:crypto';
import type { Collection, Database, Field, Model, Transaction } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { buildSearchDocument } from '../../../domain/search/SearchDocument';
import type {
  CollectionSearchDescriptor,
  IndexedSearchCandidate,
  RecordKeyValues,
} from '../../../application/ports/CollectionSearchGateway';

const DOCUMENTS_COLLECTION = 'lc_collection_search_documents';
const STATES_COLLECTION = 'lc_collection_search_states';
const INDEX_CHUNK_SIZE = 500;

interface SearchDocumentRow {
  recordKey: string;
  keyValues: RecordKeyValues;
}

interface SearchStateRow {
  schemaSignature: string;
  status: string;
}

interface TransactionOptions {
  transaction?: Transaction;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function modelValues(model: Model): Record<string, unknown> {
  const json = model.toJSON();
  return asRecord(json);
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
    keyFields: descriptor.keyFields,
    titleField: descriptor.titleField,
    fields: descriptor.searchableFields.map((field) => ({
      name: field.name,
      kind: field.kind,
      enum: field.enum,
    })),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function sourceFields(descriptor: CollectionSearchDescriptor): string[] {
  return Array.from(
    new Set([
      ...descriptor.keyFields,
      ...descriptor.searchableFields.map((field) => field.name),
      ...(descriptor.titleField ? [descriptor.titleField] : []),
    ]),
  );
}

export class NocoBaseSearchIndexRepository {
  private readonly indexedCollections = new Set<string>();
  private readonly synchronization = new Map<string, Promise<void>>();

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
      this.indexedCollections.add(
        this.collectionKey(String(row.get('dataSourceKey')), String(row.get('collectionName'))),
      );
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

  async findCandidates(input: {
    descriptor: CollectionSearchDescriptor;
    term: string;
    cursor?: string;
    limit: number;
  }): Promise<IndexedSearchCandidate[]> {
    const filter: Record<string, unknown> = {
      dataSourceKey: input.descriptor.dataSourceKey,
      collectionName: input.descriptor.collectionName,
      'searchText.$includes': input.term,
    };
    if (input.cursor) {
      filter['recordKey.$gt'] = input.cursor;
    }
    const rows = await this.plugin.db.getRepository(DOCUMENTS_COLLECTION).find({
      filter,
      fields: ['recordKey', 'keyValues'],
      sort: ['recordKey'],
      limit: input.limit,
    });
    return rows.map((row) => {
      const values = row.toJSON() as unknown as SearchDocumentRow;
      return {
        cursor: values.recordKey,
        keyValues: values.keyValues,
      };
    });
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
    const record = modelValues(model);
    const values = this.documentValues(descriptor, record);
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
      await sourceRepository.chunkWithCursor({
        fields: sourceFields(descriptor),
        chunkSize: INDEX_CHUNK_SIZE,
        callback: async (models: Model[]) => {
          const documents = models
            .map((model) => this.documentValues(descriptor, modelValues(model)))
            .filter((value): value is Record<string, unknown> => Boolean(value));
          if (documents.length) {
            await this.documentsModel().bulkCreate(documents);
          }
        },
      });
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
    ['password', 'snowflakeId'].includes(String(options.interface || ''))
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

export function describeCollection(collection: Collection, dataSourceKey: string): CollectionSearchDescriptor | null {
  const keyFields = Array.isArray(collection.filterTargetKey)
    ? collection.filterTargetKey
    : collection.filterTargetKey
      ? [collection.filterTargetKey]
      : [];
  if (!keyFields.length) {
    return null;
  }
  const searchableFields = collection
    .getFields()
    .map(searchableField)
    .filter((field): field is NonNullable<ReturnType<typeof searchableField>> => Boolean(field));
  const options = asRecord(collection.options);
  return {
    dataSourceKey,
    collectionName: collection.name,
    collectionTitle: String(options.title || collection.name),
    keyFields,
    titleField: typeof options.titleField === 'string' ? options.titleField : undefined,
    searchableFields,
  };
}
