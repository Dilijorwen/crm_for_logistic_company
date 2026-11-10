/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export const SHIPMENT_CUSTOMS_FIELD_LABELS = {
  ktc_amount: 'Сумма обеспечения',
  additional_check_response_deadline: 'Срок ответа на дополнительную проверку (10 дней)',
  additional_check_response_deadline_60_days: 'Срок ответа на дополнительную проверку (60 дней)',
} as const;

export const LOGISTICS_STATUS_VALUES = [
  'queue',
  'in_work',
  'knr',
  'in_russia',
  'warehouse',
  'submission',
  'clearance',
  'inspection',
  'expertise',
  'release_application',
  'release',
  'release_guarantee_prepare',
  'release_guarantee_badis_answer',
  'release_guarantee_to_customs',
  'release_guarantee_wait_customs',
  'release_security_ktc',
  'release_security_cost_accepted',
  're_export',
] as const;

export type LogisticsStatus = (typeof LOGISTICS_STATUS_VALUES)[number];

export const DEFAULT_LOGISTICS_STATUS: LogisticsStatus = 'queue';

export const LOGISTICS_STATUS_LABELS: Record<LogisticsStatus, string> = {
  queue: 'В очереди',
  in_work: 'В работе',
  knr: 'КНР',
  in_russia: 'РФ',
  warehouse: 'Склад',
  submission: 'В подаче',
  clearance: 'В оформлении',
  inspection: 'Досмотр',
  expertise: 'Экспертиза',
  release_application: 'Выпуск по заявлению',
  release: 'Выпуск',
  release_guarantee_prepare: 'Выпуск с ДП (подготовка ответа)',
  release_guarantee_badis_answer: 'Выпуск с ДП (ответ в Бадисе)',
  release_guarantee_to_customs: 'Выпуск с ДП (отправка ответа в ТО)',
  release_guarantee_wait_customs: 'Выпуск с ДП (ожидание решения ТО)',
  release_security_ktc: 'Выпуск под обеспечение (КТС)',
  release_security_cost_accepted: 'Выпуск под обеспечение (стоимость принята)',
  re_export: 'Реэкспорт',
};

export const LOGISTICS_STATUS_COLORS: Record<LogisticsStatus, string> = {
  queue: '#64748B',
  in_work: '#2563EB',
  knr: '#7C3AED',
  in_russia: '#0891B2',
  warehouse: '#8B5E3C',
  submission: '#DB2777',
  clearance: '#D97706',
  inspection: '#E4572E',
  expertise: '#B4233F',
  release_application: '#0F766E',
  release: '#15803D',
  release_guarantee_prepare: '#8D6AB8',
  release_guarantee_badis_answer: '#4F46A5',
  release_guarantee_to_customs: '#0369A1',
  release_guarantee_wait_customs: '#A87316',
  release_security_ktc: '#A21CAF',
  release_security_cost_accepted: '#527A22',
  re_export: '#334155',
};

export const LOGISTICS_STATUS_OPTIONS = LOGISTICS_STATUS_VALUES.map((value) => ({
  value,
  label: LOGISTICS_STATUS_LABELS[value],
  color: LOGISTICS_STATUS_COLORS[value],
}));

export const LOGISTICS_HISTORY_EVENT_LABELS = {
  created: 'Создание',
  field_initialized: 'Начальное значение',
  field_changed: 'Изменение поля',
  parent_added: 'Добавлен родительский рейс',
  parent_removed: 'Убран родительский рейс',
  child_added: 'Добавлен дочерний рейс',
  child_removed: 'Убран дочерний рейс',
  manager_added: 'Добавлен менеджер',
  manager_removed: 'Убран менеджер',
  declarant_added: 'Добавлен декларант',
  declarant_removed: 'Убран декларант',
  shipment_attached: 'Добавлена поставка',
  shipment_detached: 'Убрана поставка',
  run_attached: 'Добавлен рейс',
  run_detached: 'Убран рейс',
} as const;

export const LOGISTICS_COLLECTIONS = {
  vehicles: 'vehicles',
  runs: 'transport_runs',
  shipments: 'shipments',
  runShipments: 'transport_run_shipments',
  runManagers: 'transport_run_managers',
  runDeclarants: 'transport_run_declarants',
  runParents: 'transport_run_parent_links',
  runHistory: 'transport_run_history',
  shipmentHistory: 'shipment_history',
  shipmentComments: 'shipment_comments',
  workItems: 'logistics_work_items',
} as const;
