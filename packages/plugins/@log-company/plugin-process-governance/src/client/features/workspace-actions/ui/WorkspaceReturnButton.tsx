/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import React, { useEffect, useState } from 'react';
import { workspaceAnchors, type WorkspaceViewHost } from '../../../shared/lib';

export function WorkspaceReturnButton({ host }: { host: WorkspaceViewHost }) {
  const args = host.context.view?.inputArgs || {};
  const runId = args.workspaceReturnToRun ? workspaceAnchors(args).runId : '';
  const [number, setNumber] = useState<{ runId: string; value: string | number }>();
  useEffect(() => {
    let active = true;
    async function load() {
      if (!runId) return;
      try {
        const response = await host.context.api
          .resource('transport_runs')
          .get({ filterByTk: runId, fields: ['run_number'] });
        const value: unknown = response.data?.data?.run_number;
        if (active && (typeof value === 'string' || typeof value === 'number')) setNumber({ runId, value });
      } catch (error) {
        // A secondary title request must not prevent the page or its back action from opening.
        console.error('Не удалось загрузить номер рейса для ссылки возврата.', error);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [host, runId]);
  const suffix = number?.runId === runId ? ` №${number.value}` : '';
  const title = runId ? `К поставкам рейса${suffix}` : 'К рейсам и поставкам';
  return (
    <Button
      type="link"
      aria-label={title}
      icon={<ArrowLeftOutlined />}
      style={{ paddingLeft: 0 }}
      onClick={() => host.context.view?.close?.()}
    >
      {title}
    </Button>
  );
}
