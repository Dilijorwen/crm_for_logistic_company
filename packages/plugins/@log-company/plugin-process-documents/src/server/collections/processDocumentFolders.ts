import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'process_document_folders',
  title: 'Папки документов процесса',
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
  fields: [
    {
      type: 'snowflakeId',
      name: 'id',
      interface: 'snowflakeId',
      primaryKey: true,
      allowNull: false,
      uiSchema: {
        type: 'number',
        title: '{{t("ID")}}',
        'x-component': 'InputNumber',
        'x-component-props': { stringMode: true, separator: '0.00', step: '1' },
        'x-validator': 'integer',
      },
    },
    {
      type: 'string',
      name: 'title',
      interface: 'input',
      allowNull: false,
      uiSchema: {
        type: 'string',
        title: 'Название',
        'x-component': 'Input',
        required: true,
      },
    },
    {
      type: 'bigInt',
      name: 'process_id',
      interface: 'integer',
      isForeignKey: true,
      uiSchema: {
        type: 'number',
        title: 'process_id',
        'x-component': 'InputNumber',
        'x-read-pretty': true,
      },
    },
    {
      type: 'string',
      name: 'draft_token',
      interface: 'input',
      uiSchema: {
        type: 'string',
        title: 'Черновик процесса',
        'x-component': 'Input',
        'x-read-pretty': true,
      },
    },
    {
      type: 'bigInt',
      name: 'parent_folder_id',
      interface: 'integer',
      isForeignKey: true,
      uiSchema: {
        type: 'number',
        title: 'parent_folder_id',
        'x-component': 'InputNumber',
        'x-read-pretty': true,
      },
    },
  ],
});
