/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { observer } from '@formily/reactive-react';
import type { FlowModel } from '@nocobase/flow-engine';
import { MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH } from '../../../../shared/contracts';
import { retainWidthHeader, tableIdentity, tableOwner } from '../model/columnWidthBinding';
import type { PersonalizationController } from '../model/PersonalizationController';

const KEYBOARD_WIDTH_STEP = 10;
const clampWidth = (width: number) => Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)));

export const ColumnWidthHeader = observer(
  ({
    table,
    controller,
    columnUid,
    defaultWidth,
    title,
    children,
  }: {
    table: FlowModel;
    controller: PersonalizationController;
    columnUid: string;
    defaultWidth: number;
    title: string;
    children: React.ReactNode;
  }) => {
    const identity = tableIdentity(table);
    const identityKey = JSON.stringify(identity);
    const owner = tableOwner(table);
    const cancelDrag = useRef<(() => void) | undefined>();
    const container = useRef<HTMLDivElement>(null);
    const [headerCell, setHeaderCell] = useState<HTMLTableCellElement | null>(null);
    const width = controller.getWidth(columnUid, defaultWidth);
    const canResize = controller.matches(identity, owner) && controller.canResize(columnUid);

    useLayoutEffect(() => {
      setHeaderCell(container.current?.closest('th') || null);
    }, []);

    useEffect(() => {
      controller.activate(tableIdentity(table), owner);
      const release = retainWidthHeader(table);
      return () => {
        cancelDrag.current?.();
        release();
      };
    }, [controller, table, identityKey, owner]);

    async function commit(nextWidth: number | null): Promise<void> {
      if (!controller.matches(identity, owner)) return;
      const saved = await controller.changeWidth(columnUid, nextWidth);
      if (!saved && controller.matches(identity, owner) && controller.state.widthError)
        table.context.message?.error(controller.state.widthError);
    }

    function startDrag(event: React.MouseEvent<HTMLSpanElement>): void {
      if (!canResize || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      cancelDrag.current?.();
      const startX = event.clientX;
      let nextWidth = width;
      const previousCursor = document.body.style.cursor;
      const previousSelection = document.body.style.userSelect;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      function cleanup(): void {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', finish);
        document.removeEventListener('keydown', cancelOnEscape);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousSelection;
        cancelDrag.current = undefined;
      }
      function cancel(): void {
        cleanup();
        controller.cancelWidthPreview(columnUid);
      }
      function move(nextEvent: MouseEvent): void {
        if (!controller.matches(identity, owner)) return cancel();
        nextWidth = clampWidth(width + nextEvent.clientX - startX);
        controller.previewWidth(columnUid, nextWidth);
      }
      async function finish(): Promise<void> {
        cleanup();
        if (nextWidth === width) return controller.cancelWidthPreview(columnUid);
        await commit(nextWidth);
      }
      function cancelOnEscape(nextEvent: KeyboardEvent): void {
        if (nextEvent.key === 'Escape') {
          nextEvent.preventDefault();
          nextEvent.stopPropagation();
          cancel();
        }
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', finish);
      document.addEventListener('keydown', cancelOnEscape);
      cancelDrag.current = cancel;
    }

    async function resizeByKeyboard(event: React.KeyboardEvent<HTMLSpanElement>): Promise<void> {
      if (!canResize || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      const distance = KEYBOARD_WIDTH_STEP * (event.shiftKey ? 5 : 1);
      const nextWidth =
        event.key === 'Home'
          ? MIN_COLUMN_WIDTH
          : event.key === 'End'
            ? MAX_COLUMN_WIDTH
            : clampWidth(width + (event.key === 'ArrowRight' ? distance : -distance));
      if (nextWidth !== width) await commit(nextWidth);
    }

    const handle = canResize ? (
      <span
        role="separator"
        aria-label={`Изменить ширину столбца «${title}»`}
        aria-orientation="vertical"
        aria-valuemin={MIN_COLUMN_WIDTH}
        aria-valuemax={MAX_COLUMN_WIDTH}
        aria-valuenow={width}
        aria-valuetext={`${width} пикселей`}
        tabIndex={0}
        title="Перетащите границу или используйте стрелки. Двойной клик возвращает общую ширину"
        onMouseDown={startDrag}
        onKeyDown={resizeByKeyboard}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onDoubleClick={async (event) => {
          event.preventDefault();
          event.stopPropagation();
          await commit(null);
        }}
        style={{
          position: 'absolute',
          right: headerCell ? 0 : -7,
          top: headerCell ? 0 : -11,
          bottom: headerCell ? 0 : -11,
          width: 8,
          cursor: 'col-resize',
          zIndex: 3,
        }}
      />
    ) : null;

    return (
      <div ref={container} style={{ position: 'relative', width: '100%', minWidth: 0 }}>
        {children}
        {headerCell ? createPortal(handle, headerCell) : handle}
      </div>
    );
  },
);
