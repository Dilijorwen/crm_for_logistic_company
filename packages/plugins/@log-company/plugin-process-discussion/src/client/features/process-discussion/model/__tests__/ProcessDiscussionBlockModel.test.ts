/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';

const { define } = vi.hoisted(() => ({ define: vi.fn() }));

vi.mock('@nocobase/client', () => {
  class BlockModel {
    context: unknown;
  }
  Object.assign(BlockModel, { define });
  return { BlockModel };
});

vi.mock('../../ui/ProcessDiscussionBlock', () => ({
  ProcessDiscussionBlock: () => null,
}));

import '../ProcessDiscussionBlockModel';

describe('ProcessDiscussionBlockModel', () => {
  it('registers a readable Russian label without a translation key', () => {
    expect(define).toHaveBeenCalledWith({
      label: 'Обсуждение процесса',
      sort: 545,
    });
  });
});
