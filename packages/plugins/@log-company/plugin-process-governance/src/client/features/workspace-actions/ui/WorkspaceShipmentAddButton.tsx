/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DownOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
import React, { useRef, useState } from 'react';
import type { WorkspaceViewHost } from '../../../shared/lib';
import { openWorkspaceCreateShipment } from '../model/openWorkspaceView';
import { openWorkspaceAssociation } from '../model/openWorkspaceAssociation';
import { useWorkspaceRunPermissions } from '../model/useWorkspaceRunPermissions';

export function WorkspaceShipmentAddButton({
  host,
  runId,
  compact = false,
}: {
  host: WorkspaceViewHost;
  runId: string;
  rowId: string;
  compact?: boolean;
}) {
  const { canCreate, canAssociate, loading } = useWorkspaceRunPermissions(host, runId);
  const pending = useRef(false);
  const [opening, setOpening] = useState(false);
  async function open(action: string) {
    if (pending.current) return;
    pending.current = true;
    setOpening(true);
    try {
      if (action === 'create') await openWorkspaceCreateShipment(host, runId);
      else await openWorkspaceAssociation(host, runId);
    } catch (error) {
      console.error('Не удалось открыть действие с поставками.', error);
      host.context.message.error('Не удалось открыть действие с поставками. Повторите попытку.');
    } finally {
      pending.current = false;
      setOpening(false);
    }
  }
  return (
    <Dropdown
      trigger={['click']}
      disabled={opening || (!canCreate && !canAssociate)}
      menu={{
        items: [
          { key: 'create', label: 'Создать новую поставку', disabled: !canCreate },
          { key: 'associate', label: 'Привязать существующую', disabled: !canAssociate },
        ],
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          return open(key);
        },
      }}
    >
      <Button
        loading={loading || opening}
        size={compact ? 'small' : 'middle'}
        icon={<PlusOutlined />}
        onClick={(event) => event.stopPropagation()}
      >
        {compact ? 'Поставка' : 'Добавить поставку'} <DownOutlined />
      </Button>
    </Dropdown>
  );
}
