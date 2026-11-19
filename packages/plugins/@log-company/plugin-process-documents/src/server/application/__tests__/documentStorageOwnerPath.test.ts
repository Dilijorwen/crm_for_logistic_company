/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { documentStorageOwnerPath } from '../documentStorageOwnerPath';

describe('document storage ownership paths', () => {
  it('preserves the shipment prefix used for upload and orphan cleanup', () => {
    expect(documentStorageOwnerPath({ mode: 'shipment', shipmentId: 'shipment-1' })).toBe('shipments/shipment-1');
  });
  it('keeps draft uploads in their original namespace', () => {
    expect(documentStorageOwnerPath({ mode: 'draft', draftToken: 'draft-token' })).toBe('shipments/drafts/draft-token');
  });
});
