/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DATA_SOURCE_DIRTY_EVENT, type FlowEngine } from '@nocobase/flow-engine';

export const LOGISTICS_RECORDS_CHANGED = 'log-company:logistics-records-changed';

export function notifyWorkspaceChanged(engine: FlowEngine): void {
  const visited = new Set<FlowEngine>();
  const emitters = new Set<FlowEngine['emitter']>();
  let current: FlowEngine | undefined = engine;
  while (current && !visited.has(current)) {
    visited.add(current);
    for (const resource of ['transport_runs', 'shipments', 'logistics_work_items'])
      current.markDataSourceDirty('main', resource);
    if (!emitters.has(current.emitter)) {
      emitters.add(current.emitter);
      current.emitter.emit(LOGISTICS_RECORDS_CHANGED);
      current.emitter.emit(DATA_SOURCE_DIRTY_EVENT, {
        dataSourceKey: 'main',
        resourceNames: ['transport_runs', 'shipments', 'logistics_work_items'],
      });
    }
    current = current.previousEngine;
  }
}
