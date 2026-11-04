/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import logisticsWorkItems from '../../collections/logisticsWorkItems';

const RUN_FIELDS: Record<string, string> = {
  transport_type: 'transport_type',
  run_number: 'run_number',
  registration_number: 'registration_number_input',
  departure_city_name: 'departure_city',
  manager_names: 'managers',
  declarant_names: 'declarants',
};
const SHIPMENT_FIELDS: Record<string, string> = {
  chinese_client_name: 'chinese_client',
  company_name: 'company',
  contract_name: 'contract_record',
  customs_warehouse_name: 'customs_warehouse',
};

interface WorkspaceFieldSource {
  name: string;
  resource: string;
  sourceField: string;
  numeric: boolean;
  searchable: boolean;
}

export const LOGISTICS_WORKSPACE_FIELD_SOURCES: WorkspaceFieldSource[] = (logisticsWorkItems.fields || [])
  .filter((field) => field.name !== 'id' && !field.hidden)
  .map((field) => ({
    name: String(field.name),
    resource: RUN_FIELDS[field.name] ? 'transport_runs' : 'shipments',
    sourceField: RUN_FIELDS[field.name] || SHIPMENT_FIELDS[field.name] || field.name,
    numeric: field.type === 'integer' || field.type === 'double',
    searchable: ['string', 'text', 'integer', 'double'].includes(field.type),
  }));
