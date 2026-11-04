/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { FlowModelContext } from '@nocobase/flow-engine';
import { Alert, Skeleton, Typography } from 'antd';
import React, { useEffect, useState } from 'react';

interface HeaderProps {
  context: FlowModelContext;
  entity: 'run' | 'shipment';
  recordId: string;
  level?: 1 | 2 | 3 | 4 | 5;
}

export function WorkspaceRecordHeader({ context, entity, recordId, level = 5 }: HeaderProps) {
  const [state, setState] = useState<{ key: string; title?: string; error?: boolean }>({ key: '' });
  const key = `${entity}:${recordId}`;
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await context.api.resource(entity === 'run' ? 'transport_runs' : 'shipments').get({
          filterByTk: recordId,
          fields: entity === 'run' ? ['run_number', 'registration_number_input'] : ['shipment_number'],
        });
        const data = response.data?.data as Record<string, unknown> | undefined;
        const title =
          entity === 'run'
            ? `Рейс №${data?.run_number ?? recordId}${
                data?.registration_number_input ? ` · ${data.registration_number_input}` : ''
              }`
            : `Поставка №${data?.shipment_number ?? recordId}`;
        if (active) setState({ key, title });
      } catch (error) {
        console.error('Не удалось загрузить заголовок записи рабочего списка.', error);
        if (active) setState({ key, error: true });
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [context, entity, recordId, key]);
  if (state.key !== key) return <Skeleton.Input active size="small" />;
  if (state.error) return <Alert type="error" showIcon message="Не удалось загрузить сведения о выбранной записи." />;
  return (
    <Typography.Title level={level} style={{ margin: '0 0 16px' }}>
      {state.title}
    </Typography.Title>
  );
}
