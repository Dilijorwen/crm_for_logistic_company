/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { AimOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Flex, Tooltip, Typography } from 'antd';
import React from 'react';
import { useOrganizationTranslation } from '../../../locale';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onCenter: () => void;
}

export function ZoomControls(props: ZoomControlsProps) {
  const { t } = useOrganizationTranslation();
  return (
    <Flex className="lc-org-zoom" align="center" gap={4} data-interactive="true">
      <Tooltip title={t('canvas.zoomOut')}>
        <Button
          type="text"
          size="small"
          icon={<MinusOutlined />}
          aria-label={t('canvas.zoomOut')}
          onClick={props.onZoomOut}
        />
      </Tooltip>
      <Tooltip title={t('canvas.resetZoom')}>
        <Button type="text" size="small" aria-label={t('canvas.resetZoom')} onClick={props.onReset}>
          <Typography.Text style={{ minWidth: 42 }}>{Math.round(props.zoom * 100)}%</Typography.Text>
        </Button>
      </Tooltip>
      <Tooltip title={t('canvas.zoomIn')}>
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          aria-label={t('canvas.zoomIn')}
          onClick={props.onZoomIn}
        />
      </Tooltip>
      <Tooltip title={t('canvas.center')}>
        <Button
          type="text"
          size="small"
          icon={<AimOutlined />}
          aria-label={t('canvas.center')}
          onClick={props.onCenter}
        />
      </Tooltip>
    </Flex>
  );
}
