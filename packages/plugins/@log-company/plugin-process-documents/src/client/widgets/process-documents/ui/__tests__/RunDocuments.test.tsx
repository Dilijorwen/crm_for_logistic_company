/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { DocumentRequestScope } from '../../../../entities/process-document';
import { RunDocuments } from '../RunDocuments';

vi.mock('@nocobase/client', () => ({
  useAPIClient: () => ({ resource: () => ({ list: async () => ({ data: { data: [], meta: { count: 0 } } }) }) }),
}));
vi.mock('../ScopedDocuments', () => ({
  ScopedDocuments: ({ requestScope }: { requestScope: DocumentRequestScope }) => (
    <output>{JSON.stringify(requestScope)}</output>
  ),
}));

describe('Документы рейса', () => {
  it('opens one block scoped to the saved run directly from its card', () => {
    render(<RunDocuments runId="87" />);
    expect(screen.getByRole('status')).toHaveTextContent('{"runId":"87"}');
  });
});
