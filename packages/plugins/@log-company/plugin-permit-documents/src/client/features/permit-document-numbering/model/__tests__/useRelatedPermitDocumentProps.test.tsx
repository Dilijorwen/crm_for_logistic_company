/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRelatedPermitDocumentProps } from '../useRelatedPermitDocumentProps';

const state = vi.hoisted(() => ({ isNew: true, record: {} as { id?: string } }));
vi.mock('@nocobase/client', () => ({
  useCollectionRecord: () => ({ isNew: state.isNew }),
  useRecord: () => state.record,
}));

describe('related permit selection', () => {
  it('permits a single existing selection in a create popup even when its parent has an ID', () => {
    state.isNew = true;
    state.record = { id: 'parent' };
    const { result } = renderHook(() => useRelatedPermitDocumentProps());
    expect(result.current.disabled).toBe(false);
    expect(result.current.allowMultiple).toBe(false);
    expect(result.current.allowCreate).toBe(false);
  });

  it('permits editing a pair and limits the search to other available documents and its current partner', () => {
    state.isNew = false;
    state.record = { id: '123' };
    const { result } = renderHook(() => useRelatedPermitDocumentProps());
    expect(result.current.disabled).toBe(false);
    expect(result.current.service.params.filter).toMatchObject({
      id: { $ne: '123' },
      $or: [{ related_document_id: { $is: null } }, { related_document_id: '123' }],
      category: { $ne: 'voluntary' },
    });
  });
});
