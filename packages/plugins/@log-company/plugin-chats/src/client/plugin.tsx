/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/client';
import { useMemo } from 'react';
import enUS from '../locale/en-US.json';
import ruRU from '../locale/ru-RU.json';
import models from './features/chats/model';
import { useChatsVariableContext } from './features/chats/hooks/useChatsVariableContext';
import { ChatsPage } from './features/chats/ui/ChatsPage';
import { NAMESPACE, useChatTranslation } from './locale';

export class PluginChatsClient extends Plugin {
  async load(): Promise<void> {
    this.app.i18n.addResources('en-US', NAMESPACE, enUS);
    this.app.i18n.addResources('ru-RU', NAMESPACE, ruRU);
    this.flowEngine.registerModels(models);
    this.app.router.add('admin.chats', {
      path: '/admin/chats',
      Component: ChatsPage,
    });
    this.app.registerVariable({
      name: '$chats',
      useOption() {
        const { t } = useChatTranslation();
        return useMemo(
          () => ({
            option: {
              label: t('chat.chats'),
              value: '$chats',
            },
            visible: false,
          }),
          [t],
        );
      },
      useCtx: useChatsVariableContext,
    });
  }
}

export default PluginChatsClient;
