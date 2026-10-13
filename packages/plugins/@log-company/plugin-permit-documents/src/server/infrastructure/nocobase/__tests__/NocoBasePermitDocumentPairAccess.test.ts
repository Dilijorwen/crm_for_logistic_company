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
import { NocoBasePermitDocumentPairAccess } from '../NocoBasePermitDocumentPairAccess';

describe('permit document pair permissions', () => {
  it('rejects linking when the user has no update permission', async () => {
    const findOne = vi.fn();
    const access = new NocoBasePermitDocumentPairAccess({
      db: { getRepository: () => ({ findOne }) },
    } as unknown as Plugin);
    await expect(access.assertCanLink('123', { can: () => null }, {})).rejects.toMatchObject({
      code: 'RELATED_DOCUMENT_ACCESS_DENIED',
    });
    expect(findOne).not.toHaveBeenCalled();
  });

  it('checks the selected document against the object permission filter', async () => {
    const findOne = vi.fn().mockResolvedValue(null);
    const access = new NocoBasePermitDocumentPairAccess({
      db: { getRepository: () => ({ findOne }) },
    } as unknown as Plugin);
    const context = {
      can: () => ({ params: { filter: { company_id: '10' } } }),
      state: {},
      get: () => '+10:00',
    };
    await expect(access.assertCanLink('123', context, {})).rejects.toMatchObject({
      code: 'RELATED_DOCUMENT_ACCESS_DENIED',
    });
    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ filterByTk: '123', filter: { company_id: '10' } }));
    findOne.mockResolvedValue({ id: '123' });
    await expect(access.assertCanLink('123', context, {})).resolves.toBeUndefined();
  });

  it('rejects update permission that excludes the link field', async () => {
    const access = new NocoBasePermitDocumentPairAccess({} as Plugin);
    await expect(
      access.assertCanLink('123', { can: () => ({ params: { fields: ['title'] } }) }, {}),
    ).rejects.toMatchObject({ code: 'RELATED_DOCUMENT_ACCESS_DENIED' });
  });
});
