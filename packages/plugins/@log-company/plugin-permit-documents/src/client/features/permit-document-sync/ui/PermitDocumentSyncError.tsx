/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { DisplayTextFieldModel } from '@nocobase/client';
import { DisplayItemModel } from '@nocobase/flow-engine';
import { registryErrorMessage } from '../../../../contracts/permitDocumentMessages';

export function PermitDocumentSyncError({ value }: React.PropsWithChildren<{ value?: string | null }>) {
  return <span>{value ? registryErrorMessage(value) : '—'}</span>;
}

export class PermitDocumentSyncErrorFieldModel extends DisplayTextFieldModel {
  t(value: string | undefined | null) {
    return value ? registryErrorMessage(value) : value;
  }
}

PermitDocumentSyncErrorFieldModel.define({ label: 'Ошибка проверки документа' });
DisplayItemModel.bindModelToInterface('PermitDocumentSyncErrorFieldModel', 'textarea', {
  isDefault: true,
  when: (_context, field) => field.collectionName === 'permit_documents' && field.name === 'last_sync_error',
});
