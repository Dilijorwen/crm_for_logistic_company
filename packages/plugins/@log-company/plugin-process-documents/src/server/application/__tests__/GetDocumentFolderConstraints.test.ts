/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { expect, it, vi } from 'vitest';
import { GetDocumentFolderConstraints } from '../GetDocumentFolderConstraints';
import type { DocumentScopeService } from '../DocumentScopeService';
import { DocumentSectionAccess } from '../DocumentSectionAccess';

it('возвращает правила ВЭД компании поставки и ограничения родителей без собственных правил папки', async () => {
  const localRule = { kind: 'role' as const, subject: 'certificate', rights: { read: false } };
  const sections = new DocumentSectionAccess({
    read: async (section, company) => (section === 'ved' && company === '10' ? [localRule] : []),
    save: async () => undefined,
  });
  const grants = { rules: [{ kind: 'role' as const, subject: 'manager', rights: { write: false } }] };
  const parent = { id: '60', title: 'Отчёты', grants };
  const folder = { id: '61', title: 'Бухгалтерия', grants: { rules: [localRule] } };
  const scope = { mode: 'shipment' as const, shipmentId: '51' };
  const scopes = {
    requireFolderById: vi.fn().mockResolvedValue(folder),
    resolveForFolder: vi.fn().mockResolvedValue(scope),
    getBreadcrumbs: vi.fn().mockResolvedValue([parent, folder]),
    requireFolder: vi.fn().mockResolvedValue(parent),
  } as unknown as DocumentScopeService;
  const companies = vi.fn().mockResolvedValue(['10']);
  const result = await new GetDocumentFolderConstraints(scopes, sections, companies).execute('61', null, {
    isRoot: true,
    userId: '1',
    authorizationContext: {},
  });
  expect(companies).toHaveBeenCalledWith(scope);
  expect(result).toEqual([
    {
      type: 'section',
      section: 'ved',
      title: 'ВЭД',
      policies: [{ rules: [localRule], inherited: [] }],
      readPolicies: [{ rules: [localRule], inherited: [] }],
    },
    { type: 'folder', title: parent.title, grants },
  ]);
});
