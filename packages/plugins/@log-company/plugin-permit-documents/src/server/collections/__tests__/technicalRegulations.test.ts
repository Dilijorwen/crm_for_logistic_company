/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createMockDatabase, UniqueConstraintError } from '@nocobase/database';
import { describe, expect, it } from 'vitest';
import technicalRegulations from '../technicalRegulations';

describe('technical regulations collection', () => {
  it('rejects duplicate numbers on create and update using the field definition', async () => {
    const db = await createMockDatabase();
    try {
      const regulations = db.collection({
        name: 'technical_regulations',
        // Register only the number to exercise the same field-level sync used for an existing table.
        fields: technicalRegulations.fields?.filter((field) => field.name === 'doc_num'),
      });
      await regulations.sync();
      const first = await regulations.repository.create({ values: { doc_num: 'ТР ТС 022/2011' } });
      const second = await regulations.repository.create({ values: { doc_num: 'ТР ТС 021/2011' } });
      await expect(regulations.repository.create({ values: { doc_num: '  ТР ТС 022/2011  ' } })).rejects.toBeInstanceOf(
        UniqueConstraintError,
      );
      await expect(
        regulations.repository.update({ filterByTk: second.get('id'), values: { doc_num: first.get('doc_num') } }),
      ).rejects.toBeInstanceOf(UniqueConstraintError);
    } finally {
      await db.close();
    }
  });

  it('displays the FSA identifier without a thousands separator', () => {
    expect(technicalRegulations.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'fsa_id',
          type: 'integer',
          interface: 'integer',
          uiSchema: expect.objectContaining({
            'x-component': 'InputNumber',
            'x-component-props': expect.objectContaining({ separator: '0.00', step: '1' }),
          }),
        }),
      ]),
    );
  });
});
