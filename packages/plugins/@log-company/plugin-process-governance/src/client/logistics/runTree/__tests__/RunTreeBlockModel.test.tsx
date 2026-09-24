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

vi.mock('../RunTreeBlock', () => ({
  RunTreeBlock: () => null,
}));

import { RunTreeBlockModel } from '../RunTreeBlockModel';

interface TreeElementProps {
  entityKind: 'run';
  modelContext: { collection?: unknown; record?: Record<string, unknown> | null; filterByTk?: unknown };
}

function renderModel(context: unknown): TreeElementProps {
  const instance = Object.assign(Object.create(RunTreeBlockModel.prototype), { context }) as RunTreeBlockModel;
  return (instance.renderComponent() as React.ReactElement<TreeElementProps>).props;
}

describe('RunTreeBlockModel', () => {
  it('registers the run tree block in the NocoBase designer', () => {
    expect(define).toHaveBeenCalledWith({ label: 'Дерево рейсов', sort: 547 });
  });

  it('passes the current run record to the visual block', () => {
    const runRecord = { id: '20', run_number: 4 };
    const props = renderModel({ collection: { name: 'transport_runs' }, record: runRecord });

    expect(props.entityKind).toBe('run');
    expect(props.modelContext).toMatchObject({ collection: { name: 'transport_runs' }, record: runRecord });
  });

  it('uses popup view arguments for a block placed beside the run edit form', () => {
    const props = renderModel({
      collection: { name: 'customs_processes' },
      filterByTk: 'outer-record',
      view: { inputArgs: { collectionName: 'transport_runs', filterByTk: 'run-42' } },
    });

    expect(props.modelContext).toMatchObject({ collection: 'transport_runs', filterByTk: 'run-42' });
  });
});
