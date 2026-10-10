/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useEffect } from 'react';
import { Button, Tooltip } from 'antd';
import { TableOutlined } from '@ant-design/icons';
import { observer } from '@nocobase/flow-engine';
import { useACLContext, useCurrentUserContext } from '@nocobase/client';
import type { PersonalizedTableBlockModel } from '../model/PersonalizedTableBlockModel';

export const ColumnSettingsButton = observer(({ model }: { model: PersonalizedTableBlockModel }) => {
  const controller = model.personalization;
  const state = controller.state;
  const acl = useACLContext();
  const user = useCurrentUserContext();
  const owner = model.getPersonalizationOwner();
  const identitySignature = JSON.stringify(model.getPersonalizationIdentity());

  useEffect(() => {
    if (model.context.flowSettingsEnabled) {
      model.closePersonalizationSettings();
      return;
    }
    const identity = model.getPersonalizationIdentity();
    if (!controller.matches(identity, owner)) model.closePersonalizationSettings();
    controller.activate(identity, owner);
  }, [controller, model, owner, identitySignature, acl?.data, user?.data, model.context.flowSettingsEnabled]);

  if (model.context.flowSettingsEnabled) return null;
  return (
    <Tooltip title="Колонки">
      <Button
        aria-label="Колонки"
        icon={<TableOutlined />}
        onClick={() => model.openPersonalizationSettings()}
        disabled={state.isSaving}
      />
    </Tooltip>
  );
});
