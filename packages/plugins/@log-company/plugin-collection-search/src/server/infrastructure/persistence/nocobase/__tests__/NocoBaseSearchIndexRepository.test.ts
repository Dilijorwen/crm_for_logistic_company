/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Collection, Database, Field, Model } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { describe, expect, it, vi } from 'vitest';
import {
  describeCollection,
  NocoBaseSearchIndexRepository,
  serializeRecordKey,
} from '../NocoBaseSearchIndexRepository';

function field(name: string, type: string, options: Record<string, unknown> = {}, relation = false): Field {
  return {
    name,
    type,
    options,
    isRelationField: () => relation,
  } as unknown as Field;
}

describe('NocoBaseSearchIndexRepository metadata', () => {
  it('selects scalar fields and excludes IDs, foreign keys, passwords and relations', () => {
    const collection = {
      name: 'customs_processes',
      filterTargetKey: 'id',
      options: { title: 'Customs', titleField: 'title' },
      getFields: () => [
        field('id', 'bigInt', { primaryKey: true }),
        field('title', 'string', { uiSchema: { title: 'Title' } }),
        field('declaration_number', 'string', { uiSchema: { title: 'DT number' } }),
        field('created_at', 'date', { uiSchema: { title: 'Created at' } }),
        field('owner_id', 'bigInt', { isForeignKey: true }),
        field('secret', 'string', { interface: 'password' }),
        field('owner', 'belongsTo', {}, true),
      ],
    } as unknown as Collection;

    const result = describeCollection(collection, 'main');

    expect(result?.searchableFields.map((item) => item.name)).toEqual(['title', 'declaration_number', 'created_at']);
    expect(result?.keyFields).toEqual(['id']);
  });

  it('serializes composite record keys deterministically', () => {
    expect(serializeRecordKey({ second: 2, first: 1 })).toBe('{"first":1,"second":2}');
  });

  it('waits for an active rebuild before applying source updates', async () => {
    let releaseBuild: (() => void) | undefined;
    let markBuildStarted: (() => void) | undefined;
    const buildStarted = new Promise<void>((resolve) => {
      markBuildStarted = resolve;
    });
    const buildBlocked = new Promise<void>((resolve) => {
      releaseBuild = resolve;
    });
    const documentUpsert = vi.fn(async () => undefined);
    const documentModel = {
      destroy: vi.fn(async () => undefined),
      bulkCreate: vi.fn(async () => undefined),
      upsert: documentUpsert,
    };
    const stateModel = {
      upsert: vi.fn(async () => undefined),
    };
    const pluginDatabase = {
      getRepository: vi.fn(() => ({ findOne: vi.fn(async () => null) })),
      getCollection: vi.fn((name: string) => ({
        model: name === 'lc_collection_search_documents' ? documentModel : stateModel,
      })),
    };
    const sourceDatabase = {
      getRepository: vi.fn(() => ({
        chunkWithCursor: vi.fn(async () => {
          markBuildStarted?.();
          await buildBlocked;
        }),
      })),
    } as unknown as Database;
    const sourceCollection = {
      name: 'customs_processes',
      db: sourceDatabase,
      filterTargetKey: 'id',
      options: { titleField: 'title' },
      getFields: () => [field('id', 'bigInt', { primaryKey: true }), field('title', 'string')],
    } as unknown as Collection;
    const sourceModel = {
      toJSON: () => ({ id: 1, title: 'Updated title' }),
    } as unknown as Model;
    const repository = new NocoBaseSearchIndexRepository({ db: pluginDatabase } as unknown as Plugin);
    const descriptor = describeCollection(sourceCollection, 'main');

    expect(descriptor).not.toBeNull();
    if (!descriptor) {
      throw new Error('The test collection must be searchable.');
    }
    const rebuild = repository.ensureSynchronized(descriptor, sourceDatabase, sourceCollection);
    await buildStarted;
    const update = repository.upsertSourceModel('main', sourceCollection, sourceModel, {});
    await Promise.resolve();

    expect(documentUpsert).not.toHaveBeenCalled();
    releaseBuild?.();
    await rebuild;
    await update;
    expect(documentUpsert).toHaveBeenCalledOnce();
  });
});
