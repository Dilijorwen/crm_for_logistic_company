/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection } from '@nocobase/database';
import { idField } from './logisticsCollectionFields';

export default defineCollection({
  name: 'shipment_comments',
  title: 'Комментарии к поставкам',
  hidden: true,
  template: 'general',
  view: false,
  autoGenId: false,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
  logging: true,
  filterTargetKey: ['id'],
  migrationRules: ['overwrite', 'schema-only'],
  indexes: [{ name: 'shipment_comments_shipment_created_at_idx', fields: ['shipment_id', 'createdAt'] }],
  fields: [
    idField,
    { type: 'bigInt', name: 'shipment_id', interface: 'integer', isForeignKey: true, allowNull: false },
    {
      type: 'belongsTo',
      name: 'shipment',
      interface: 'm2o',
      target: 'shipments',
      targetKey: 'id',
      foreignKey: 'shipment_id',
      onDelete: 'CASCADE',
      allowNull: false,
      uiSchema: {
        type: 'object',
        title: 'Поставка',
        'x-component': 'AssociationField',
        'x-component-props': { multiple: false, fieldNames: { value: 'id', label: 'display_name' } },
        required: true,
      },
    },
    {
      type: 'text',
      name: 'text',
      interface: 'textarea',
      allowNull: false,
      uiSchema: {
        type: 'string',
        title: 'Комментарий',
        'x-component': 'Input.TextArea',
        required: true,
      },
    },
    {
      type: 'belongsToMany',
      name: 'attachment',
      interface: 'attachment',
      target: 'attachments',
      targetKey: 'id',
      sourceKey: 'id',
      through: 'shipment_comment_attachments',
      foreignKey: 'shipment_comment_id',
      otherKey: 'attachment_id',
      onDelete: 'CASCADE',
      storage: 'local',
      uiSchema: {
        type: 'array',
        title: 'Вложения',
        'x-component': 'Upload.Attachment',
        'x-use-component-props': 'useAttachmentFieldProps',
        'x-component-props': { multiple: true },
      },
    },
  ],
});
