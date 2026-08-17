/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';

const ROUTE_SCHEMA_UID = 'lcorgstruct';
const MENU_TITLE_KEY = '@log-company/plugin-organization-structure.menuTitle';
const LEGACY_MENU_TITLE = '{{t("menu.title", { ns: "@log-company/plugin-organization-structure" })}}';

interface DesktopRouteModel {
  id: string | number | bigint;
}

interface DesktopRoutesRepository {
  findOne(options: { filter: { schemaUid: string } }): Promise<DesktopRouteModel | null>;
  update(options: { filterByTk: string | number | bigint; values: { title: string } }): Promise<unknown>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const routes = this.db.getRepository('desktopRoutes') as unknown as DesktopRoutesRepository;
    const existing = await routes.findOne({ filter: { schemaUid: ROUTE_SCHEMA_UID } });
    if (existing) {
      await routes.update({ filterByTk: existing.id, values: { title: MENU_TITLE_KEY } });
    }
  }

  async down(): Promise<void> {
    const routes = this.db.getRepository('desktopRoutes') as unknown as DesktopRoutesRepository;
    const existing = await routes.findOne({ filter: { schemaUid: ROUTE_SCHEMA_UID } });
    if (existing) {
      await routes.update({ filterByTk: existing.id, values: { title: LEGACY_MENU_TITLE } });
    }
  }
}
