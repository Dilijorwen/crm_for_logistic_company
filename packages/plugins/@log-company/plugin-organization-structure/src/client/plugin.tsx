/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/client';
import enUS from '../locale/en-US.json';
import ruRU from '../locale/ru-RU.json';
import { configurePublicAuthRoutes } from './configurePublicAuthRoutes';
import { MENU_TITLE_KEY, NAMESPACE } from './locale';
import { OrganizationStructurePage } from './features/organization/ui/OrganizationStructurePage';
import { SECURE_RESET_PASSWORD_COMPONENT, SecureResetPasswordPage } from './password/SecureResetPasswordPage';
import { registerPasswordPolicyValidator } from './registerPasswordPolicyValidator';

export class PluginOrganizationStructureClient extends Plugin {
  async beforeLoad(): Promise<void> {
    this.app.eventBus.addEventListener(
      'plugin:auth:loaded',
      () => {
        configurePublicAuthRoutes(this.app.router);
      },
      { once: true },
    );
  }

  async load(): Promise<void> {
    configurePublicAuthRoutes(this.app.router);
    this.app.i18n.addResource('en-US', 'lm-desktop-routes', MENU_TITLE_KEY, enUS['menu.title']);
    this.app.i18n.addResource('ru-RU', 'lm-desktop-routes', MENU_TITLE_KEY, ruRU['menu.title']);
    this.app.i18n.addResources('en-US', NAMESPACE, enUS);
    this.app.i18n.addResources('ru-RU', NAMESPACE, ruRU);
    registerPasswordPolicyValidator((key) => this.app.i18n.t(key, { ns: NAMESPACE }));
    this.app.addComponents({
      [SECURE_RESET_PASSWORD_COMPONENT]: SecureResetPasswordPage,
    });
    this.app.router.add('admin.organization-structure', {
      path: '/admin/organization-structure',
      Component: OrganizationStructurePage,
    });
  }
}

export default PluginOrganizationStructureClient;
