/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useFlowViewContext, type CreateModelOptions, type FlowModel } from '@nocobase/flow-engine';
import { useEffect, useRef, useState } from 'react';

/** Native model creation must receive the view before onInit creates dependent children. */
export function useWorkspaceViewModel(options: CreateModelOptions, onLoaded?: (uid: string, model: FlowModel) => void) {
  const ctx = useFlowViewContext();
  const callback = useRef(onLoaded);
  callback.current = onLoaded;
  const [model, setModel] = useState<FlowModel>();
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setModel(undefined);
    setError(false);
    async function load() {
      try {
        const loaded = await ctx.engine.loadOrCreateModel(options, {
          delegateToParent: false,
          delegate: ctx,
          skipSave: !ctx.flowSettingsEnabled,
        });
        if (!loaded) throw new Error('Не найдена конфигурация окна.');
        if (!active) return;
        loaded.context.addDelegate(ctx);
        loaded.removeParentDelegate();
        callback.current?.(loaded.uid, loaded);
        setModel(loaded);
      } catch (cause) {
        console.error('Не удалось загрузить содержимое окна.', cause);
        if (active) setError(true);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [ctx, options, revision]);
  return { model, error, retry: () => setRevision((value) => value + 1) };
}
