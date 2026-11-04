/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { TableIdentity } from '../../../../shared/contracts';
import type { FilterTemplate, TableTemplateSnapshot } from '../../../../shared/filterTemplates';
import type { FilterTemplatesController } from './FilterTemplatesController';

export interface TableTemplateHost {
  readonly templates: FilterTemplatesController;
  getPersonalizationIdentity(): TableIdentity;
  getPersonalizationOwner(): string;
  captureTemplateSnapshot(): Promise<TableTemplateSnapshot>;
  applyTableTemplate(template?: FilterTemplate): Promise<boolean>;
  isTemplateOperationBlocked(): boolean;
}
