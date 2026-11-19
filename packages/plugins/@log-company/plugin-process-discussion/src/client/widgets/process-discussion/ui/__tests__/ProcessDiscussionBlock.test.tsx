/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const resource = vi.fn();
  return {
    context: {} as Record<string, unknown>,
    list: vi.fn(),
    resource,
    api: { resource },
  };
});
vi.mock('@nocobase/client', () => ({
  css: () => 'discussion-block',
  useAPIClient: () => state.api,
  useCurrentUserContext: () => ({ data: { data: { id: 'reader' } } }),
  useCollection: () => state.context.collection,
  useCollectionManager: () => undefined,
  useCollectionRecord: () => state.context.collectionRecord,
  useCurrentPopupRecord: () => undefined,
  useDataBlockProps: () => undefined,
  useFormBlockContext: () => state.context.form,
  useRecord: () => state.context.record,
}));
vi.mock('@nocobase/flow-engine', () => ({ useFlowContext: () => state.context.flow }));
vi.mock(
  '@log-company/plugin-process-governance/client',
  async () => import('../../../../../../../plugin-process-governance/src/client/shared/lib'),
);

import { ProcessDiscussionBlock } from '../ProcessDiscussionBlock';

beforeEach(() => {
  state.context = {};
  state.list.mockReset().mockResolvedValue({ data: { data: [], meta: { count: 0 } } });
  state.resource.mockReset().mockReturnValue({ list: state.list });
  window.history.replaceState(null, '', '/admin');
  Element.prototype.scrollTo = vi.fn();
});

describe('discussion block shipment context', () => {
  it('loads comments for the current shipment popup instead of its outer run', async () => {
    state.context = {
      collection: 'transport_runs',
      record: { id: 'run-9' },
      flow: { view: { inputArgs: { collectionName: 'shipments', filterByTk: 'shipment-4' } } },
    };
    state.list.mockResolvedValue({
      data: { data: [{ id: 'comment', text: 'Обсуждение поставки', createdAt: '2026-11-16' }], meta: { count: 1 } },
    });
    render(<ProcessDiscussionBlock />);
    await waitFor(() => expect(screen.getByText('Обсуждение поставки')).toBeInTheDocument());
    expect(state.resource).toHaveBeenCalledWith('shipments.comments', 'shipment-4');
    expect(state.resource).not.toHaveBeenCalledWith('shipments.comments', 'run-9');
  });

  it('does not load outer comments while the shipment create form is open', () => {
    state.context = { form: { collectionName: 'shipments', type: 'create' }, record: { id: 'outer' } };
    render(<ProcessDiscussionBlock processId="outer" />);
    expect(state.resource).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Сначала сохраните');
  });
});
