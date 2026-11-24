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
  it('проверяет связь контракта с компанией перед доступом к дополнительным соглашениям', async () => {
    const plugin = {
      db: {
        getRepository: (name: string) =>
          name === 'contracts.importers'
            ? { find: async () => [{ get: () => '10' }] }
            : { findOne: async () => ({ id: '10' }) },
      },
    } as unknown as Plugin;
    const sections = new DocumentSectionAccess({
      read: async (section) =>
        section === 'contracts' ? [{ kind: 'role', subject: 'manager', rights: { write: false, rename: true } }] : [],
      save: async () => undefined,
    });
    const access = new NocoBaseProcessDocumentAccess(plugin, sections);
    const actor = { userId: '7', isRoot: false, roles: ['manager'], authorizationContext: { can: () => ({}) } };
    const scope = { mode: 'company', companyId: '10', companyArea: 'contract:40' } as const;
    await expect(access.assertCompanyAccess(scope, 'read', actor)).resolves.toBeUndefined();
    await expect(access.assertCompanyAccess(scope, 'rename', actor)).resolves.toBeUndefined();
    await expect(access.assertCompanyAccess(scope, 'write', actor)).rejects.toMatchObject({
      code: 'DOCUMENT_ACCESS_DENIED',
    });
    await expect(access.assertCompanyAccess({ ...scope, companyId: '11' }, 'read', actor)).rejects.toMatchObject({
      code: 'DOCUMENT_ACCESS_DENIED',
    });
  });
  it('проверяет право загрузки в разделе разрешительных документов компании', async () => {
    const plugin = { db: { getRepository: () => ({ findOne: async () => ({ id: '10' }) }) } } as unknown as Plugin;
    const sections = new DocumentSectionAccess({
      read: async (section) =>
        section === 'permits' ? [{ kind: 'role', subject: 'manager', rights: { write: false } }] : [],
      save: async () => undefined,
    });
    const access = new NocoBaseProcessDocumentAccess(plugin, sections);
    const actor = { userId: '7', isRoot: false, roles: ['manager'], authorizationContext: { can: () => ({}) } };
    const scope = { mode: 'company', companyId: '10', companyArea: 'permits' } as const;
    await expect(access.assertCompanyAccess(scope, 'read', actor)).resolves.toBeUndefined();
    await expect(access.assertCompanyAccess(scope, 'write', actor)).rejects.toMatchObject({
      code: 'DOCUMENT_ACCESS_DENIED',
    });
    await expect(
      access.assertCompanyAccess({ ...scope, companyArea: 'company' }, 'write', actor),
    ).resolves.toBeUndefined();
  });
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

  it('allows a create-only user to write only the record saved in the current transaction', async () => {
    const { actor, access, can } = fixture();
    can.mockImplementation(({ action }) => (action === 'create' ? {} : null));
    const creator = { ...actor, creatingOwner: { resource: 'transport_runs' as const, recordId: '87' } };
    await expect(access.assertRunAccess('87', 'write', creator, null, {})).resolves.toBeUndefined();
    await expect(access.assertRunAccess('88', 'write', creator, null, {})).rejects.toMatchObject({
      code: 'DOCUMENT_ACCESS_DENIED',
    });
  });

  it('does not allow a permit upload when access to the attachments field is excluded', async () => {
    const { actor, access, can } = fixture();
    can.mockImplementation(() => ({ params: { whitelist: ['title'] } }));
    await expect(access.assertPermitUpload('50', actor, {})).rejects.toMatchObject({
      code: 'DOCUMENT_ACCESS_DENIED',
    });
    can.mockImplementation(() => ({ params: { whitelist: ['documents'] } }));
    await expect(access.assertPermitUpload('50', actor, {})).resolves.toBeUndefined();
  });
});
