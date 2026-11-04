/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { LinkOutlined } from '@ant-design/icons';
import { observer } from '@nocobase/flow-engine';
import { List, Popover, Tag, Typography, theme } from 'antd';
import React from 'react';
import type { WorkspaceRunLink } from '../../../../shared/workspace';
import type { WorkspaceViewHost } from '../../../shared/lib';
import { openWorkspaceRun } from '../model/openWorkspaceView';

export const WorkspaceSharedShipmentBadge = observer(
  ({ host, shipmentId }: { host: WorkspaceViewHost; shipmentId: string }) => {
    const { token } = theme.useToken();
    const workspace = host.flowEngine.getModel('lcwsgroupedtable', true);
    const getLinks = (host.context.getWorkspaceShipmentRuns || workspace?.context.getWorkspaceShipmentRuns) as
      | ((id: string) => WorkspaceRunLink[])
      | undefined;
    const links = typeof getLinks === 'function' ? getLinks(shipmentId) : [];
    if (links.length < 2) return null;
    return (
      <Popover
        trigger="click"
        title="Связанные рейсы"
        content={
          <List
            size="small"
            dataSource={links}
            renderItem={(run) => (
              <List.Item>
                <Typography.Link
                  onClick={(event) => {
                    event.stopPropagation();
                    return openWorkspaceRun(host, run.id, `${run.id}:${shipmentId}`);
                  }}
                >
                  Рейс №{run.run_number ?? '—'} · {run.registration_number || '—'}
                  {run.departure_city_name ? <div>{run.departure_city_name}</div> : null}
                </Typography.Link>
              </List.Item>
            )}
          />
        }
      >
        <Tag
          icon={<LinkOutlined />}
          style={{
            cursor: 'pointer',
            color: token.colorPrimaryText,
            background: token.colorPrimaryBg,
            borderColor: token.colorPrimaryBorder,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {links.length}{' '}
          {links.length % 10 >= 2 && links.length % 10 <= 4 && !(links.length % 100 >= 12 && links.length % 100 <= 14)
            ? 'рейса'
            : 'рейсов'}
        </Tag>
      </Popover>
    );
  },
);
