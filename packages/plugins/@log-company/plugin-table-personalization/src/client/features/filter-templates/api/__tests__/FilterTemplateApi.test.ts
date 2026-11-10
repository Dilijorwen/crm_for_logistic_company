/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { TableFilterTemplateApi } from '../FilterTemplateApi';

describe('table template API', () => {
  it('passes the updated template id as a NocoBase query parameter and in the body', async () => {
    const data = { templates: [], schemaSignature: 'signature' };
    const request = vi.fn().mockResolvedValue({ data: { data } });
    const input = { identity: { tableUid: 'table', referencePath: [] }, id: 'template', revision: 1 };
    await expect(new TableFilterTemplateApi({ request }).request('update', input)).resolves.toEqual(data);
    expect(request).toHaveBeenCalledWith({
      url: 'tableFilterTemplates:update',
      method: 'post',
      params: { filterByTk: 'template' },
      data: input,
      skipNotify: true,
    });
  });
});
