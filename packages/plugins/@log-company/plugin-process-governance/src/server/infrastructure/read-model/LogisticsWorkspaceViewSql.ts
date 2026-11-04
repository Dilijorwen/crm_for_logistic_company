/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

/**
 * Database read model used by the configurable logistics workspace table.
 *
 * The view intentionally keeps a run with no attached shipment. This gives a
 * manager one place to create or attach the first shipment without returning
 * to the separate runs table.
 */
export const LOGISTICS_WORKSPACE_VIEW_SQL = `
  CREATE OR REPLACE VIEW public.logistics_work_items AS
  SELECT
    run.id::text || ':' || COALESCE(link.shipment_id::text, '0') AS id,
    run.run_number,
    vehicle.registration_number,
    departure_city.name AS departure_city_name,
    manager_list.names AS manager_names,
    declarant_list.names AS declarant_names,
    shipment.shipment_number,
    chinese_client.name AS chinese_client_name,
    company.name AS company_name,
    contract.name AS contract_name,
    shipment.status,
    shipment.invoice_number,
    shipment.invoice_value,
    shipment.customs_scheme,
    customs_warehouse.name AS customs_warehouse_name,
    shipment.customs_warehouse_storage_date,
    shipment.declaration_number,
    shipment.application_number,
    shipment.documents_in_badis,
    shipment.customs_payments_amount,
    shipment.eco_fee,
    shipment.ktc_amount,
    shipment.ntm_certificate_goods,
    shipment.ntm_skk_goods,
    shipment.ntm_kfk_goods,
    shipment.ntm_honest_sign_goods,
    shipment.ntm_export_declaration_required,
    shipment.ntm_honest_sign_sum,
    shipment.goods_count,
    shipment.entered_in_1c,
    shipment.sent_to_client,
    shipment.additional_check_response_deadline,
    shipment.actual_control,
    shipment.anosov_distributed,
    shipment.manager_comment,
    run.id AS run_id,
    shipment.id AS shipment_id,
    run.transport_type
  FROM transport_runs run
  INNER JOIN vehicles vehicle ON vehicle.id = run.vehicle_id
  LEFT JOIN transport_run_shipments link ON link.transport_run_id = run.id
  LEFT JOIN shipments shipment ON shipment.id = link.shipment_id
  LEFT JOIN departure_cities departure_city ON departure_city.id = run.departure_city_id
  LEFT JOIN chinese_clients chinese_client ON chinese_client.id = shipment.chinese_client_id
  LEFT JOIN our_companies company ON company.id = shipment.company_id
  LEFT JOIN contracts contract ON contract.id = shipment.contract_id
  LEFT JOIN customs_warehouses customs_warehouse ON customs_warehouse.id = shipment.customs_warehouse_id
  LEFT JOIN LATERAL (
    SELECT string_agg(
      DISTINCT COALESCE(NULLIF(manager.nickname, ''), manager.username),
      ', ' ORDER BY COALESCE(NULLIF(manager.nickname, ''), manager.username)
    ) AS names
    FROM transport_run_managers manager_link
    INNER JOIN users manager ON manager.id = manager_link.user_id
    WHERE manager_link.transport_run_id = run.id
  ) manager_list ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(
      DISTINCT COALESCE(NULLIF(declarant.nickname, ''), declarant.username),
      ', ' ORDER BY COALESCE(NULLIF(declarant.nickname, ''), declarant.username)
    ) AS names
    FROM transport_run_declarants declarant_link
    INNER JOIN users declarant ON declarant.id = declarant_link.user_id
    WHERE declarant_link.transport_run_id = run.id
  ) declarant_list ON true
`;
