/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { Button, Checkbox, Flex } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, HolderOutlined } from '@ant-design/icons';
import { useSortable } from '@dnd-kit/sortable';
import type { PersonalizableColumn } from '../../../../shared/contracts';

interface ColumnRowProps {
  column: PersonalizableColumn;
  isVisible: boolean;
  isDisabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onVisibility(checked: boolean): void;
  onMove(direction: -1 | 1): void;
}

export function ColumnRow({
  column,
  isVisible,
  isDisabled,
  canMoveUp,
  canMoveDown,
  onVisibility,
  onMove,
}: ColumnRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: column.uid,
    disabled: isDisabled,
  });
  return (
    <Flex
      ref={setNodeRef}
      align="center"
      gap="small"
      style={{
        padding: '8px 0',
        transition,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
    >
      <Button
        type="text"
        icon={<HolderOutlined />}
        {...attributes}
        {...listeners}
        aria-label={`Переместить колонку ${column.title}`}
        disabled={isDisabled}
        style={{ touchAction: 'none' }}
      />
      <Checkbox
        checked={isVisible}
        disabled={isDisabled}
        onChange={(event) => onVisibility(event.target.checked)}
        style={{ flex: 1 }}
      >
        {column.title}
      </Checkbox>
      <Button
        type="text"
        icon={<ArrowUpOutlined />}
        aria-label={`Выше: ${column.title}`}
        disabled={isDisabled || !canMoveUp}
        onClick={() => onMove(-1)}
      />
      <Button
        type="text"
        icon={<ArrowDownOutlined />}
        aria-label={`Ниже: ${column.title}`}
        disabled={isDisabled || !canMoveDown}
        onClick={() => onMove(1)}
      />
    </Flex>
  );
}
