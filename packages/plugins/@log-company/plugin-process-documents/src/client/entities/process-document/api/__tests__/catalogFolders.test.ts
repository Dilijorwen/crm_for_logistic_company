/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { permitCatalogFolders, runCatalogFolders } from '../catalogFolders';

describe('Стандартные папки файлового менеджера', () => {
  it('помещает рейс в год и месяц самой ранней связанной поставки', () => {
    const years = runCatalogFolders([
      {
        id: '87',
        run_number: 87,
        vehicle: { registration_number: 'А123ВС' },
        shipments: [{ createdAt: '2026-11-14' }, { createdAt: '2026-10-29' }],
      },
      { id: '88', run_number: 88, shipments: [{ createdAt: '2026-11-15' }] },
    ]);

    expect(years).toEqual([
      {
        id: '2026',
        title: '2026',
        children: [
          { id: '2026-11', title: 'Ноябрь', items: [{ id: '88', title: 'Рейс №88' }] },
          { id: '2026-10', title: 'Октябрь', items: [{ id: '87', title: 'Рейс №87 - А123ВС' }] },
        ],
      },
    ]);
  });

  it('создаёт подпапки только при нескольких разных типах под одним номером и статусом', () => {
    const folders = permitCatalogFolders([
      { id: '1', internal_number: '14', status: 'valid', document_type: 'declaration_of_conformity' },
      { id: '2', internal_number: '14', status: 'valid', document_type: 'declaration_of_conformity' },
      { id: '3', internal_number: '14', status: 'suspended', document_type: 'state_registration_certificate' },
      { id: '4', internal_number: '15', status: 'terminated', document_type: 'declaration_of_conformity' },
      { id: '5', internal_number: '15', status: 'terminated', document_type: 'certificate_of_conformity' },
    ]);

    expect(folders.map(({ title }) => title)).toEqual(['Действителен', 'Приостановлен', 'Прекращен']);
    expect(folders[0].children?.[0]).toEqual({ id: '14', title: '14', attachments: ['1', '2'] });
    expect(folders[1].children?.[0].attachments).toEqual(['3']);
    expect(folders[2].children?.[0].children).toEqual([
      { id: 'ДС', title: 'ДС', attachments: ['4'] },
      { id: 'СС', title: 'СС', attachments: ['5'] },
    ]);
  });
});
