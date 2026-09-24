/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { DocumentActor } from './ProcessDocumentsRepository';

export type ProcessDocumentOperation = 'read' | 'write' | 'delete';

export interface ProcessDocumentAccess {
  assertAccess(shipmentId: string, operation: ProcessDocumentOperation, actor: DocumentActor): Promise<void>;
}
