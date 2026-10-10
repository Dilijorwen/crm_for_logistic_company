/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { TablePersonalizationApi } from '../TablePersonalizationApi';

describe('personalization API parameters', () => {
  it('omits stale width maps from layout saves and sends width mutations independently', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ data: { data: { settings: null, columns: [], schemaSignature: 'a'.repeat(64) } } });
    const api = new TablePersonalizationApi({ request });
    const identity = { tableUid: 'table', referencePath: ['reference'] };
    const signature = 'a'.repeat(64);
    await api.save(
      identity,
      { version: 1, columnOrder: ['column'], hiddenColumnUids: [], columnWidths: { column: 200 } },
      signature,
    );
    expect(request).toHaveBeenLastCalledWith({
      url: 'tablePersonalizations:save',
      method: 'post',
      skipNotify: true,
      data: {
        identity,
        schemaSignature: signature,
        settings: { version: 1, columnOrder: ['column'], hiddenColumnUids: [] },
      },
    });
    await api.width(identity, 'column', 250, signature);
    expect(request).toHaveBeenLastCalledWith({
      url: 'tablePersonalizations:width',
      method: 'post',
      skipNotify: true,
      data: { identity, schemaSignature: signature, columnUid: 'column', width: 250 },
    });
  });
});
