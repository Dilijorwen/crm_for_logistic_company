/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin, useActionAvailable, useCollection } from '@nocobase/client';
import enUS from '../locale/en-US.json';
import ruRU from '../locale/ru-RU.json';
import { NAMESPACE } from './locale';
import { usePermitDocumentSyncActionProps } from './features/permit-document-sync/usePermitDocumentSyncActionProps';

const actionTitle = `{{t("action.checkNow", { ns: "${NAMESPACE}" })}}`;

function usePermitDocumentSyncVisible(): boolean {
  const collection = useCollection();
  const available = useActionAvailable('update');
  return collection.name === 'permit_documents' && available;
}

export class PluginPermitDocumentsClient extends Plugin {
  async load(): Promise<void> {
    this.app.i18n.addResources('en-US', NAMESPACE, enUS);
    this.app.i18n.addResources('ru-RU', NAMESPACE, ruRU);
    this.app.addScopes({ usePermitDocumentSyncActionProps });
    this.app.schemaInitializerManager.addItem('table:configureItemActions', 'actions.checkPermitDocumentNow', {
      title: actionTitle,
      Component: 'ActionInitializer',
      schema: {
        title: actionTitle,
        'x-component': 'Action.Link',
        'x-use-component-props': 'usePermitDocumentSyncActionProps',
        'x-action': 'sync',
        'x-acl-action': 'update',
        'x-toolbar': 'ActionSchemaToolbar',
      },
      useVisible: usePermitDocumentSyncVisible,
    });
  }
}

export default PluginPermitDocumentsClient;
