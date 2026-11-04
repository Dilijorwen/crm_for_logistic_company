/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useCallback, useEffect, useState } from 'react';
import { LOGISTICS_RECORDS_CHANGED, type WorkspaceViewHost } from '../../../shared/lib';
import { WorkspaceSummaryApi, type RunSummary } from '../api/WorkspaceSummaryApi';

export function useRunSummary(host: WorkspaceViewHost, runId: string) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ data?: RunSummary; loading: boolean; error: boolean }>({
    loading: true,
    error: false,
  });
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setState({ loading: true, error: false });
    async function load() {
      try {
        const data = await new WorkspaceSummaryApi(host.context.api).get(runId);
        if (active) setState({ data, loading: false, error: false });
      } catch (error) {
        console.error('Не удалось загрузить краткие сведения рейса.', error);
        if (active) setState({ loading: false, error: true });
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [host, runId, revision]);
  useEffect(() => {
    host.flowEngine.emitter.on(LOGISTICS_RECORDS_CHANGED, reload);
    return () => host.flowEngine.emitter.off(LOGISTICS_RECORDS_CHANGED, reload);
  }, [host, reload]);
  return { ...state, reload };
}
