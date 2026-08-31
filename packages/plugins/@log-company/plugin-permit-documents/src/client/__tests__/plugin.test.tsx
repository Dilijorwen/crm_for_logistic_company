/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import enUS from '../../locale/en-US.json';
import { PluginPermitDocumentsClient } from '../plugin';

describe('PluginPermitDocumentsClient', () => {
  it('registers Check now as a visible table row action initializer', async () => {
    const addItem = vi.fn();
    const app = {
      i18n: { addResources: vi.fn() },
      addScopes: vi.fn(),
      schemaInitializerManager: { addItem },
    };
    const plugin = Object.create(PluginPermitDocumentsClient.prototype) as PluginPermitDocumentsClient;
    Object.defineProperty(plugin, 'app', { value: app });

    await plugin.load();

    expect(addItem).toHaveBeenCalledWith(
      'table:configureItemActions',
      'actions.checkPermitDocumentNow',
      expect.objectContaining({
        Component: 'ActionInitializer',
        schema: expect.objectContaining({
          'x-component': 'Action.Link',
          'x-use-component-props': 'usePermitDocumentSyncActionProps',
        }),
      }),
    );
  });

  it('keeps table labels in Russian while the English settings action remains English', () => {
    expect(enUS['collection.permitDocuments']).toBe('Разрешительные документы');
    expect(enUS['field.title']).toBe('Номер документа');
    expect(enUS['status.valid']).toBe('Действителен');
    expect(enUS['action.checkNow']).toBe('Check now');
  });
});
