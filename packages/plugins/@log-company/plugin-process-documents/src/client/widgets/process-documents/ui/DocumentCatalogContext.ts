/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createContext } from 'react';

export const DocumentCatalogContext = createContext<{
  path: readonly string[];
  manageAccess: boolean;
  onDocumentsChanged?: () => void;
  initialFolderId?: string;
  onFolderLocationChange?: (folderId: string | undefined, isVirtual: boolean) => void;
  toolbarTarget?: HTMLElement | null;
  onCompanyFolderLocationChange: (atRoot: boolean) => void;
} | null>(null);
