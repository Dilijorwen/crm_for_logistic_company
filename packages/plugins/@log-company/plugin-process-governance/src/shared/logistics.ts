/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

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
  in_russia: 'В России',
  warehouse: 'Склад',
  submission: 'Подача',
  clearance: 'Оформление',
  inspection: 'Досмотр',
  expertise: 'Экспертиза',
  release_application: 'Заявление на выпуск',
  release: 'Выпуск',
  release_guarantee_prepare: 'Подготовка обеспечения',
  release_guarantee_badis_answer: 'Ответ БАДИС по обеспечению',
  release_guarantee_to_customs: 'Обеспечение направлено в таможню',
  release_guarantee_wait_customs: 'Ожидание таможни по обеспечению',
  release_security_ktc: 'Обеспечение КТС',
  release_security_cost_accepted: 'Стоимость обеспечения принята',
  re_export: 'Реэкспорт',
};

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
} as const;
