import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'process_history',
  title: 'История процессов',
  template: 'general',
  view: false,
  autoGenId: false,
  createdAt: true,
  createdBy: true,
  updatedBy: false,
  updatedAt: false,
  logging: false,
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
        'x-component-props': {
          stringMode: true,
          separator: '0.00',
          step: '1',
        },
        'x-validator': 'integer',
      },
    },
    {
      type: 'bigInt',
      name: 'process_id',
      interface: 'integer',
      isForeignKey: true,
      allowNull: false,
      uiSchema: {
        type: 'number',
        title: 'process_id',
        'x-component': 'InputNumber',
        'x-read-pretty': true,
      },
    },
    {
      type: 'string',
      name: 'event_type',
      interface: 'select',
      uiSchema: {
        type: 'string',
        title: 'Тип события',
        'x-component': 'Select',
        enum: [
          { value: 'created', label: 'Создание' },
          { value: 'field_changed', label: 'Изменение поля' },
          { value: 'parent_added', label: 'Добавлен родитель' },
          { value: 'parent_removed', label: 'Удален родитель' },
        ],
      },
    },
    {
      type: 'string',
      name: 'field_name',
      interface: 'input',
      uiSchema: {
        type: 'string',
        title: 'Техническое имя поля',
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'field_label',
      interface: 'input',
      uiSchema: {
        type: 'string',
        title: 'Название поля',
        'x-component': 'Input',
      },
    },
    {
      type: 'text',
      name: 'old_value',
      interface: 'textarea',
      uiSchema: {
        type: 'string',
        title: 'Старое значение',
        'x-component': 'Input.TextArea',
      },
    },
    {
      type: 'text',
      name: 'new_value',
      interface: 'textarea',
      uiSchema: {
        type: 'string',
        title: 'Новое значение',
        'x-component': 'Input.TextArea',
      },
    },
  ],
});
