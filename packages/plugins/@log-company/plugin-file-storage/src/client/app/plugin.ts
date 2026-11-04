/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/client';
import PluginFileManager from '@nocobase/plugin-file-manager/client';

export default class PluginFileStorageClient extends Plugin {
  async load(): Promise<void> {
    this.app.pm.get(PluginFileManager).registerStorageType('log-company-private-minio', {
      title: 'Файлы Log Company (MinIO)',
      name: 'log-company-private-minio',
      fieldset: {
        title: { type: 'string', title: 'Название', 'x-component': 'Input', 'x-decorator': 'FormItem' },
        name: {
          type: 'string',
          title: 'Имя хранилища',
          'x-component': 'Input',
          'x-decorator': 'FormItem',
          'x-read-pretty': true,
        },
      },
    });
  }
}
