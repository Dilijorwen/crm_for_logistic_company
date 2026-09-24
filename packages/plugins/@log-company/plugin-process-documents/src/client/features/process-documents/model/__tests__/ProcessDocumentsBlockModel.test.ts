/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

const { define } = vi.hoisted(() => ({ define: vi.fn() }));

vi.mock('@nocobase/client', () => {
  class BlockModel {
    context: unknown;
  }
  Object.assign(BlockModel, { define });
  return { BlockModel };
});

vi.mock('../../ui/ProcessDocumentsBlock', () => ({
  ProcessDocumentsBlock: () => null,
}));

import { ProcessDocumentsBlockModel } from '../ProcessDocumentsBlockModel';

interface DocumentsElementProps {
  modelContext: {
    collection?: unknown;
    record?: Record<string, unknown> | null;
    filterByTk?: unknown;
    params?: Record<string, unknown>;
    model?: unknown;
  };
}

function renderModel(context: unknown): DocumentsElementProps {
  const instance = Object.assign(Object.create(ProcessDocumentsBlockModel.prototype), {
    context,
  }) as ProcessDocumentsBlockModel;
  return (instance.renderComponent() as React.ReactElement<DocumentsElementProps>).props;
}

describe('ProcessDocumentsBlockModel', () => {
  it('registers a readable Russian label without a translation key', () => {
    expect(define).toHaveBeenCalledWith({
      label: 'Документы поставки',
      sort: 547,
    });
  });

  it('uses the current shipment popup arguments instead of the outer run context', () => {
    const props = renderModel({
      collection: { name: 'transport_runs' },
      filterByTk: 'run-17',
      view: { inputArgs: { collectionName: 'shipments', filterByTk: 'shipment-42' } },
    });

    expect(props.modelContext).toMatchObject({
      collection: 'shipments',
      filterByTk: 'shipment-42',
    });
  });
});
