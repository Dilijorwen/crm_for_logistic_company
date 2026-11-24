/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { DocumentScope } from '../domain/documents/DocumentScope';
import { contractAreaId } from '../../contracts/processDocuments';

export function documentStorageOwnerPath(scope: DocumentScope): string {
  if (scope.mode === 'run') return `runs/${scope.runId}`;
  if (scope.mode === 'company') {
    const contract = contractAreaId(scope.companyArea);
    const area = contract ? `contracts/${contract}/agreements` : scope.companyArea || 'corporate';
    return `companies/${scope.companyId}/${area}`;
  }
  return scope.mode === 'shipment' ? `shipments/${scope.shipmentId}` : `shipments/drafts/${scope.draftToken}`;
}
