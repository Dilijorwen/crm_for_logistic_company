/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useTranslation } from 'react-i18next';

export const NAMESPACE = '@log-company/plugin-organization-structure';
export const MENU_TITLE_KEY = '@log-company/plugin-organization-structure.menuTitle';

export function useOrganizationTranslation() {
  return useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
}
