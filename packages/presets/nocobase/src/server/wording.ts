/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export const getAutoDeletePluginsWarning = (plugins: string[]) => {
  return `The following plugins have been automatically removed from the database as they no longer exist and are not enabled: ${plugins.join(
    ',',
  )}. You can reinstall it using the plugin package at any time.`;
};

export const getNotExistsEnabledPluginsError = (plugins: Map<string, string>, app: string) => {
  const pluginNames = Array.from(plugins.keys()).map((name) => plugins.get(name) || name);
  const appOption = app === 'main' ? '' : ` --app ${app}`;
  const removeCmds = `yarn pm remove ${Array.from(plugins.keys()).join(' ')} --force${appOption}`;
  const enErrMsg = `
The following plugins you are currently using will become commercial plugins after the upgrade:
${pluginNames.join(', ')}

💎 If you are interested in purchasing, please visit: https://www.nocobase.com/commercial.html for more detail.

If you decide not to use them anymore, please delete them from the "applicationPlugins" table. You can use the command:
${removeCmds}
`;
  const ruErrMsg = `
Следующие используемые плагины после обновления станут коммерческими:
${pluginNames.join(', ')}

💎 Если вы заинтересованы в покупке, подробности доступны на странице: https://www.nocobase.com/commercial.html

Если вы больше не планируете использовать эти плагины, удалите их записи из таблицы "applicationPlugins".
Для этого можно выполнить команду:
${removeCmds}
`;

  return {
    'en-US': enErrMsg,
    'ru-RU': ruErrMsg,
  };
};
