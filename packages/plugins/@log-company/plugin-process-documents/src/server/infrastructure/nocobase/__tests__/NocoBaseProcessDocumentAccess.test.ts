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
import { NocoBaseProcessDocumentAccess } from '../NocoBaseProcessDocumentAccess';
import { DocumentSectionAccess } from '../../../application/DocumentSectionAccess';

function fixture() {
  const findCompany = vi.fn(async () => ({ id: '10' }));
  const findRun = vi.fn(async (): Promise<{ id: string } | null> => ({ id: '87' }));
  const plugin = {
    db: { getRepository: (name: string) => ({ findOne: name === 'our_companies' ? findCompany : findRun }) },
  } as unknown as Plugin;
  const can = vi.fn(({ action }: { resource: string; action: string }) => (action === 'get' ? {} : null));
  const actor = { userId: '7', isRoot: false, authorizationContext: { can } };
  return { actor, can, findCompany, findRun, access: new NocoBaseProcessDocumentAccess(plugin) };
}

describe('Access to shared run documents', () => {
  it('blocks writes in both the customs card and company catalog when a linked company denies them', async () => {
    const findOne = vi.fn(async () => ({
      get: (key: string) => (key === 'shipments' ? [{ company_id: '10' }, { company_id: '11' }] : '10'),
    }));
    const plugin = { db: { getRepository: () => ({ findOne }) } } as unknown as Plugin;
    const sections = new DocumentSectionAccess({
      read: async (_section, company) =>
        company === '10' ? [{ kind: 'role', subject: 'declarant', rights: { write: false } }] : [],
      save: async () => undefined,
    });
    const access = new NocoBaseProcessDocumentAccess(plugin, sections);
    const actor = { userId: '7', isRoot: false, roles: ['declarant'], authorizationContext: { can: () => ({}) } };
    await expect(access.assertAccess('42', 'read', actor)).resolves.toBeUndefined();
    await expect(access.assertAccess('42', 'write', actor)).rejects.toMatchObject({ code: 'DOCUMENT_ACCESS_DENIED' });
    await expect(access.assertRunAccess('87', 'write', actor, null)).rejects.toMatchObject({
      code: 'DOCUMENT_ACCESS_DENIED',
    });
    await expect(access.assertRunAccess('87', 'write', actor, '11')).rejects.toMatchObject({
      code: 'DOCUMENT_ACCESS_DENIED',
    });
  });
  it('checks run access with no company context and requires update rights to modify files', async () => {
    const { actor, access, can, findRun, findCompany } = fixture();
    await access.assertRunAccess('87', 'read', actor, null);
    expect(findRun).toHaveBeenCalledWith({ filter: { id: '87' } });
    expect(findCompany).not.toHaveBeenCalled();
    await expect(access.assertRunAccess('87', 'write', actor, null)).rejects.toMatchObject({
      code: 'DOCUMENT_ACCESS_DENIED',
    });
    expect(can).toHaveBeenLastCalledWith({ resource: 'transport_runs', action: 'update' });
  });

  it('requires a visible linked company when opening documents from the catalog', async () => {
    const { actor, access, can, findRun } = fixture();
    await access.assertRunAccess('87', 'read', actor, '10');
    expect(can).toHaveBeenCalledWith({ resource: 'our_companies', action: 'get' });
    expect(findRun).toHaveBeenCalledWith({ filter: { id: '87', 'shipments.company_id': '10' } });
    findRun.mockResolvedValueOnce(null);
    await expect(access.assertRunAccess('87', 'read', actor, '11')).rejects.toMatchObject({
      code: 'OWNER_NOT_FOUND',
    });
  });

  it('does not grant run document access from company permissions alone', async () => {
    const { actor, access, can } = fixture();
    can.mockImplementation(({ resource }) => (resource === 'our_companies' ? {} : null));
    await expect(access.assertRunAccess('87', 'read', actor, '10')).rejects.toMatchObject({
      code: 'DOCUMENT_ACCESS_DENIED',
    });
  });
});
