/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

const { apiClient, resource, routeKey } = vi.hoisted(() => {
  const resource = vi.fn();
  return { apiClient: { resource }, resource, routeKey: { value: undefined as string | undefined } };
});

vi.mock('@nocobase/client', () => {
  const collection = {
    name: 'transport_runs',
    getField: () => ({ uiSchema: { enum: [{ value: 'queue', label: 'В очереди' }] } }),
  };
  return {
    css: () => 'process-tree-test',
    useAPIClient: () => apiClient,
    useCollection: () => null,
    useCollectionManager: () => ({ getCollection: () => collection }),
    useCollectionRecord: () => null,
    useCurrentPopupRecord: () => null,
    useDataBlockProps: () => null,
    useFormBlockContext: () => null,
    useRecord: () => null,
  };
});

vi.mock('../../../processContext/getInnermostRouteFilterByTk', () => ({
  getInnermostRouteFilterByTk: () => routeKey.value,
}));

import { resolveTreeRecordUrl, RunTreeBlock } from '../RunTreeBlock';

interface RunNode {
  id: string;
  run_number: number;
  status: string;
  createdAt: string;
}

const nodes: Record<string, RunNode> = {
  a: { id: 'a', run_number: 1, status: 'queue', createdAt: '2026-09-01T00:00:00Z' },
  b: { id: 'b', run_number: 2, status: 'queue', createdAt: '2026-09-02T00:00:00Z' },
  e: { id: 'e', run_number: 3, status: 'queue', createdAt: '2026-09-03T00:00:00Z' },
  c: { id: 'c', run_number: 4, status: 'queue', createdAt: '2026-09-04T00:00:00Z' },
};

const parents: Record<string, string[]> = { a: [], b: [], e: ['a', 'b'], c: ['e'] };
const children: Record<string, string[]> = { a: ['e'], b: ['e'], e: ['c'], c: [] };

function response<T>(data: T) {
  return { data: { data } };
}

describe('RunTreeBlock for transport runs', () => {
  beforeEach(() => {
    resource.mockReset();
    routeKey.value = undefined;
  });

  function mockRunResources() {
    resource.mockImplementation((name: string, id?: string) => {
      if (name === 'transport_runs') {
        return { get: async () => response(nodes.e) };
      }
      if (name === 'transport_runs.parent_runs') {
        return { list: async () => response((parents[String(id)] || []).map((parentId) => nodes[parentId])) };
      }
      if (name === 'transport_runs.child_runs') {
        return { list: async () => response((children[String(id)] || []).map((childId) => nodes[childId])) };
      }
      if (name === 'transport_run_history') {
        return { list: async () => response([]) };
      }
      throw new Error(`Unexpected resource: ${name}`);
    });
  }

  it('shows one current run below both parents and repeats its child in each branch', async () => {
    mockRunResources();

    render(<RunTreeBlock entityKind="run" recordId="e" />);

    await waitFor(() => expect(screen.getAllByText('Текущий рейс')).toHaveLength(2));
    expect(screen.getByText('Дерево рейсов')).toBeInTheDocument();
    expect(screen.getByText('Рейс №1')).toBeInTheDocument();
    expect(screen.getByText('Рейс №2')).toBeInTheDocument();
    expect(screen.getAllByText('Рейс №3')).toHaveLength(2);
    expect(screen.getAllByText('Рейс №4')).toHaveLength(2);
    expect(screen.getAllByText('Рейс №3').every((item) => item.closest('button')?.disabled)).toBe(true);
    expect(screen.getByText('Рейс №1').closest('button')).toBeEnabled();
    expect(screen.getByText('Рейс №2').closest('button')).toBeEnabled();
    expect(screen.getAllByText('Рейс №4').every((item) => !item.closest('button')?.disabled)).toBe(true);
    expect(resource).toHaveBeenCalledWith('transport_runs.parent_runs', 'e');
    expect(resource).toHaveBeenCalledWith('transport_runs.child_runs', 'e');
  });

  it('uses the current popup route when the standalone block has no record context', async () => {
    routeKey.value = 'e';
    mockRunResources();

    render(<RunTreeBlock entityKind="run" />);

    await waitFor(() => expect(screen.getAllByText('Текущий рейс')).toHaveLength(2));
    expect(screen.queryByText('Сначала сохраните рейс, чтобы увидеть дерево связей.')).not.toBeInTheDocument();
  });

  it('builds a route to another run while preserving the current detail view', () => {
    expect(
      resolveTreeRecordUrl(
        'http://localhost:13000/admin/page/view/run-details/filterbytk/current-run?tab=relations',
        'parent/run',
      ),
    ).toBe('/admin/page/view/run-details/filterbytk/parent%2Frun?tab=relations');
  });
});
