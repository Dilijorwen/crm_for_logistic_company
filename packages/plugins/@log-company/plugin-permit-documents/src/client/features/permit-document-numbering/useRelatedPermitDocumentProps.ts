/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useCollectionRecord, useRecord } from '@nocobase/client';

export function useRelatedPermitDocumentProps() {
  const record = useRecord() as { id?: string | number } | undefined;
  const collectionRecord = useCollectionRecord();
  return {
    disabled: collectionRecord?.isNew === false || (collectionRecord?.isNew !== true && record?.id != null),
    multiple: false,
    allowMultiple: false,
    allowCreate: false,
    fieldNames: { label: 'name', value: 'id' },
    service: { params: { filter: { related_document_id: { $is: null } } } },
  };
}
