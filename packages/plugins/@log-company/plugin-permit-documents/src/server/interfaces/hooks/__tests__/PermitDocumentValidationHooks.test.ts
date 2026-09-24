/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { describe, expect, it, vi } from 'vitest';
import type { PermitDocumentRepository } from '../../../application/ports/PermitDocumentRepository';
import { PermitDocumentValidationHooks } from '../PermitDocumentValidationHooks';

type HookHandler = (model: MutableModel, options: HookOptions) => void | Promise<void>;

interface HookOptions {
  context?: unknown;
}

interface MutableModel {
  isNewRecord: boolean;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  changed(key: string): boolean;
  previous(key: string): unknown;
}

function hookFixture() {
  const handlers = new Map<string, HookHandler>();
  const plugin = {
    db: {
      on: vi.fn((eventName: string, handler: HookHandler) => {
        handlers.set(eventName, handler);
      }),
    },
  } as unknown as Plugin;
  const repository = { clearTechnicalRegulations: vi.fn() } as unknown as PermitDocumentRepository;
  new PermitDocumentValidationHooks(plugin, repository).register();
  return { handlers, repository };
}

function model(
  values: Record<string, unknown>,
  changedFields: string[] = [],
  previousValues = values,
  isNewRecord = false,
): MutableModel {
  return {
    isNewRecord,
    get: (key) => values[key],
    set: (key, value) => {
      values[key] = value;
    },
    changed: (key) => changedFields.includes(key),
    previous: (key) => previousValues[key],
  };
}

const registryValues = {
  name: 'DOC-1 от 01.08.2026 до 01.08.2027',
  valid_from: '2026-08-01',
  valid_until: '2027-08-01',
  status: 'valid',
  product_information: 'Product',
  external_id: '123',
  external_status: '6',
  sync_status: 'SUCCESS',
  last_checked_at: new Date('2026-08-28T00:00:00Z'),
  last_sync_error: null,
};

describe('PermitDocumentValidationHooks', () => {
  it('resets managed fields without starting synchronization from a model hook', async () => {
    const { handlers } = hookFixture();
    const values = { id: '10', title: '  DOC-1  ', document_type: 'declaration_of_conformity', ...registryValues };
    await handlers.get('permit_documents.beforeValidate')?.(model(values, [], values, true), {});

    expect(values).toMatchObject({
      title: 'DOC-1',
      name: 'DOC-1',
      sync_status: 'PENDING',
      external_id: null,
      status: null,
    });
    expect(handlers.has('permit_documents.afterCreate')).toBe(false);
  });

  it('restores attempted managed changes for a company-only update', async () => {
    const { handlers, repository } = hookFixture();
    const previous = {
      id: '11',
      title: 'DOC-2',
      document_type: 'certificate_of_conformity',
      ...registryValues,
      name: 'DOC-2 от 01.08.2026 до 01.08.2027',
    };
    const values = { ...previous, company_id: '2', name: 'Manual name', status: 'terminated' };
    const updateModel = model(values, ['company_id', 'name', 'status'], previous);
    await handlers.get('permit_documents.beforeValidate')?.(updateModel, {});
    await handlers.get('permit_documents.afterUpdate')?.(updateModel, {});

    expect(values.status).toBe('valid');
    expect(values.name).toBe('DOC-2 от 01.08.2026 до 01.08.2027');
    expect(repository.clearTechnicalRegulations).not.toHaveBeenCalled();
  });

  it('clears old registry data and technical regulations when title changes', async () => {
    const { handlers, repository } = hookFixture();
    const previous = { id: '12', title: 'DOC-OLD', document_type: 'declaration_of_conformity', ...registryValues };
    const values = { ...previous, title: 'DOC-NEW' };
    const updateModel = model(values, ['title'], previous);
    await handlers.get('permit_documents.beforeValidate')?.(updateModel, {});
    await handlers.get('permit_documents.afterUpdate')?.(updateModel, {});

    expect(values).toMatchObject({
      name: 'DOC-NEW',
      sync_status: 'PENDING',
      external_id: null,
      valid_from: null,
      status: null,
    });
    expect(repository.clearTechnicalRegulations).toHaveBeenCalledWith('12', undefined);
  });
});
