/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { FlowModel } from '@nocobase/flow-engine';
import { Card, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import { LOGISTICS_RECORDS_CHANGED } from '../../../shared/lib';
import { ScopedNativeBlock } from './ScopedNativeBlock';

function WorkspaceRunDocuments({ model, runId }: { model: FlowModel; runId: string }) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const emitter = model.flowEngine.emitter;
    emitter.on(LOGISTICS_RECORDS_CHANGED, refresh);
    return () => {
      emitter.off(LOGISTICS_RECORDS_CHANGED, refresh);
    };
  }, [model]);
  return <ScopedNativeBlock key={revision} host={model} templateUid={`${model.uid}files`} runId={runId} />;
}

export class LogisticsWorkspaceRunDocumentsModel extends FlowModel {
  render() {
    const runId: unknown = this.context.view?.inputArgs?.filterByTk;
    if (typeof runId === 'string' || typeof runId === 'number')
      return <WorkspaceRunDocuments model={this} runId={String(runId)} />;
    return (
      <Card size="small" title="Документы рейса">
        <Typography.Text type="secondary">Документы станут доступны после первого сохранения рейса.</Typography.Text>
      </Card>
    );
  }
}
