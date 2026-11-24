/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useMemo } from 'react';
import type { CatalogId } from '../../../entities/process-document';
import { ScopedDocuments } from './ScopedDocuments';

export function RunDocuments({
  runId,
  companyId,
  readOnly,
  allowUpload,
  showRefresh,
  children,
}: {
  runId: CatalogId;
  companyId?: CatalogId;
  readOnly?: boolean;
  allowUpload?: boolean;
  showRefresh?: boolean;
  children?: React.ReactNode;
}) {
  const scope = useMemo(() => ({ runId, companyId }), [runId, companyId]);
  return (
    <ScopedDocuments
      title="Документы рейса"
      titleAsHeading
      requestScope={scope}
      readOnly={readOnly}
      allowUpload={allowUpload}
      showRefresh={showRefresh}
    >
      {children}
    </ScopedDocuments>
  );
}
