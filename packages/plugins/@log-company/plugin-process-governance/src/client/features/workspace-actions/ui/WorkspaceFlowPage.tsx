/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { FlowModelRenderer, useFlowViewContext, type FlowModel } from '@nocobase/flow-engine';
import { Alert, Button, Skeleton, Space } from 'antd';
import React, { useMemo } from 'react';
import { useWorkspaceViewModel } from '../model/useWorkspaceViewModel';

/** Keep native page models, designer settings and openView's unsaved-form close handler. */
export function WorkspaceFlowPage({
  parentId,
  pageModelClass = 'ChildPageModel',
  onModelLoaded,
  ...rest
}: {
  parentId?: string;
  pageModelClass?: string;
  onModelLoaded?: (uid: string, model: FlowModel) => void;
}) {
  const ctx = useFlowViewContext();
  const options = useMemo(
    () => ({ parentId, use: pageModelClass, async: true, subKey: 'page', subType: 'object' as const }),
    [parentId, pageModelClass],
  );
  const { model, error, retry } = useWorkspaceViewModel(options, onModelLoaded);
  if (error)
    return (
      <Alert
        type="error"
        showIcon
        message="Не удалось загрузить карточку."
        action={
          <Space>
            <Button onClick={retry}>Повторить</Button>
            <Button onClick={() => ctx.view.close()}>Закрыть</Button>
          </Space>
        }
      />
    );
  return model ? (
    <FlowModelRenderer
      model={model}
      hideRemoveInSettings
      showFlowSettings={{ showBackground: false, showBorder: false }}
      showErrorFallback
      {...rest}
    />
  ) : (
    <Skeleton active />
  );
}
