/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { RecordSelectFieldModel } from '@nocobase/client';
import { EditableItemModel } from '@nocobase/flow-engine';
import { relatedPermitDocumentFilter } from './useRelatedPermitDocumentProps';

export class RelatedPermitDocumentFieldModel extends RecordSelectFieldModel {
  updateAssociation = false;
}

RelatedPermitDocumentFieldModel.define({ label: 'Связанный документ' });
RelatedPermitDocumentFieldModel.registerFlow({
  key: 'permitDocumentPairSettings',
  sort: 1000,
  steps: {
    enforcePairRules: {
      handler(context) {
        const blockContext = context.blockModel?.context;
        const documentId = blockContext?.actionName === 'update' ? blockContext.record?.id : undefined;
        context.model.setProps({
          allowMultiple: false,
          allowCreate: false,
          quickCreate: 'none',
        });
        context.model.resource.addFilterGroup('permit-document-pair', relatedPermitDocumentFilter(documentId));
      },
    },
  },
});

EditableItemModel.bindModelToInterface('RelatedPermitDocumentFieldModel', 'm2o', {
  isDefault: true,
  when: (_context, field) => field.collectionName === 'permit_documents' && field.name === 'related_document',
});
