/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import technicalRegulations from '../technicalRegulations';

describe('technical regulations collection', () => {
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
