/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { AssociateActionModel } from '@nocobase/client';
import { FlowModelRenderer, useFlowViewContext } from '@nocobase/flow-engine';
import { Alert, Button, Skeleton, Space } from 'antd';
import React, { useMemo, useRef, useState } from 'react';
import { useWorkspaceViewModel } from '../model/useWorkspaceViewModel';

/** NocoBase 2.0.60's selector loader shows a skeleton on rejection as well as on loading.
 * Keep its saved grid and selection action; make failed loads and submits recoverable. */
export function WorkspaceAssociationSelector({ model }: { model: AssociateActionModel }) {
  const ctx = useFlowViewContext();
  const options = useMemo(
    () => ({
      parentId: model.uid,
      subKey: 'associate-selector-grid',
      async: true,
      subType: 'object' as const,
      use: 'BlockGridModel',
    }),
    [model.uid],
  );
  const { model: grid, error, retry } = useWorkspaceViewModel(options);
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  async function submit() {
    if (pending.current || !grid) return;
    if (!model.selectedRows.length) {
      ctx.message.warning('Выберите хотя бы одну поставку.');
      return;
    }
    pending.current = true;
    setSubmitting(true);
    try {
      await model.associateSelectedRows();
      await ctx.view.close();
    } catch (cause) {
      console.error('Не удалось привязать поставки.', cause);
      ctx.message.error('Не удалось привязать поставки. Повторите попытку.');
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }
  const { Header, Footer } = ctx.view;
  return (
    <>
      {Header && <Header title="Привязать существующую поставку" />}
      {error ? (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить поставки."
          action={<Button onClick={retry}>Повторить</Button>}
        />
      ) : grid ? (
        <FlowModelRenderer model={grid} showFlowSettings={ctx.flowSettingsEnabled} showErrorFallback />
      ) : (
        <Skeleton active />
      )}
      {Footer && (
        <Footer>
          <Space>
            <Button disabled={submitting} onClick={() => ctx.view.close()}>
              Отмена
            </Button>
            <Button type="primary" disabled={!grid || error} loading={submitting} onClick={submit}>
              Привязать
            </Button>
          </Space>
        </Footer>
      )}
    </>
  );
}
