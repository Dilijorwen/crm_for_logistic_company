/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useCollectionRecord, useRecord } from '@nocobase/client';

export function relatedPermitDocumentFilter(documentId?: string | number) {
  const available = { related_document_id: { $is: null } };
  return {
    category: { $ne: 'voluntary' },
    ...(documentId == null
      ? available
      : { id: { $ne: documentId }, $or: [available, { related_document_id: documentId }] }),
  };
}

export function useRelatedPermitDocumentProps() {
  const record = useRecord() as { id?: string | number } | undefined;
  const collectionRecord = useCollectionRecord();
  return {
    disabled: false,
    multiple: false,
    allowMultiple: false,
    allowCreate: false,
    fieldNames: { label: 'name', value: 'id' },
    service: { params: { filter: relatedPermitDocumentFilter(collectionRecord?.isNew ? undefined : record?.id) } },
  };
}
