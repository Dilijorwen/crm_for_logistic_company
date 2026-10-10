/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useEffect, useState } from 'react';
import { App, Button, Alert, Empty, Flex, Input, Space, Spin, Typography } from 'antd';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { observer } from '@nocobase/flow-engine';
import { moveDraftColumn, normalizeDraft } from '../lib/columnLayout';
import type { PersonalizedTableBlockModel } from '../model/PersonalizedTableBlockModel';
import { ColumnRow } from './ColumnRow';

export const ColumnSettingsDialog = observer(
  ({ model, view }: { model: PersonalizedTableBlockModel; view: PersonalizedTableBlockModel['context']['view'] }) => {
    const controller = model.personalization;
    const state = controller.state;
    const { message } = App.useApp();
    const [draft, setDraft] = useState(() =>
      normalizeDraft(state.data?.settings || null, model.getPersonalizableColumns()),
    );
    const columns = model.getPersonalizableColumns();
    const [query, setQuery] = useState('');
    const search = query.trim().toLocaleLowerCase('ru');
    const matchesSearch = (column: (typeof columns)[number]) =>
      `${column.title} ${column.fieldPath}`.toLocaleLowerCase('ru').includes(search);
    const columnSignature = JSON.stringify(columns);
    const isBusy = state.isLoading || state.isSaving;
    const Footer = view.Footer;
    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    useEffect(() => {
      let active = true;
      async function load(): Promise<void> {
        await controller.reload();
        if (active) setDraft(normalizeDraft(controller.state.data?.settings || null, model.getPersonalizableColumns()));
      }
      load();
      return () => {
        active = false;
      };
    }, [controller, model]);

    useEffect(() => {
      setDraft((previous) => normalizeDraft(previous, model.getPersonalizableColumns()));
    }, [model, columnSignature]);

    useEffect(() => {
      view.beforeClose = () => !controller.state.isSaving;
      view.update({ closable: !state.isSaving, maskClosable: !state.isSaving, keyboard: !state.isSaving });
    }, [controller, view, state.isSaving]);

    async function save(): Promise<void> {
      if (await controller.save(draft)) {
        await view.close();
        message.success('Настройки столбцов сохранены');
      }
    }

    async function reset(): Promise<void> {
      if (await controller.reset()) {
        await view.close();
        message.success('Восстановлены исходные столбцы таблицы');
      }
    }

    function reorder(event: DragEndEvent): void {
      const target = event.over?.id;
      if (target) setDraft((previous) => moveDraftColumn(previous, columns, String(event.active.id), String(target)));
    }

    function move(uid: string, direction: -1 | 1): void {
      const group = columns.find((column) => column.uid === uid)?.fixed;
      const order = draft.columnOrder.filter((key) => columns.find((column) => column.uid === key)?.fixed === group);
      const target = order[order.indexOf(uid) + direction];
      if (target) setDraft((previous) => moveDraftColumn(previous, columns, uid, target));
    }

    return (
      <>
        {Footer && (
          <Footer>
            <Flex justify="space-between" gap="small" wrap>
              <Button onClick={reset} disabled={isBusy || !state.data}>
                Сбросить мои настройки
              </Button>
              <Space>
                <Button onClick={() => view.close()} disabled={state.isSaving}>
                  Отмена
                </Button>
                <Button
                  type="primary"
                  onClick={save}
                  loading={state.isSaving}
                  disabled={state.isLoading || !state.data}
                >
                  Сохранить
                </Button>
              </Space>
            </Flex>
          </Footer>
        )}
        <Typography.Paragraph type="secondary">
          Выберите доступные для просмотра поля коллекции. Настройки применяются только к вашей таблице. Закреплённые
          столбцы перемещаются внутри своей группы.
        </Typography.Paragraph>
        <Input
          aria-label="Поиск полей"
          placeholder="Поиск по названию поля"
          allowClear
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ marginBottom: 12 }}
        />
        {state.error && (
          <Alert
            type="error"
            showIcon
            message={state.error}
            action={
              <Button size="small" onClick={() => controller.reload()} disabled={isBusy}>
                Повторить
              </Button>
            }
          />
        )}
        {state.isLoading ? (
          <Spin />
        ) : !columns.length ? (
          <Empty description="Нет доступных столбцов для настройки" />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={reorder}
            accessibility={{
              screenReaderInstructions: {
                draggable:
                  'Нажмите пробел, чтобы переместить столбец. Стрелки меняют позицию, пробел подтверждает, Escape отменяет перенос.',
              },
              announcements: {
                onDragStart: () => 'Начат перенос столбца',
                onDragOver: ({ over }) =>
                  over
                    ? `Позиция: ${columns.find((column) => column.uid === String(over.id))?.title || ''}`
                    : 'Нет позиции для переноса',
                onDragEnd: () => 'Перенос завершён. Столбцы перемещаются только внутри своей группы',
                onDragCancel: () => 'Перенос отменён',
              },
            }}
          >
            <SortableContext items={draft.columnOrder} strategy={verticalListSortingStrategy}>
              {draft.columnOrder.map((uid) => {
                const column = columns.find((item) => item.uid === uid);
                if (!column || !matchesSearch(column)) return null;
                const groupOrder = draft.columnOrder.filter(
                  (key) => columns.find((item) => item.uid === key)?.fixed === column.fixed,
                );
                return (
                  <ColumnRow
                    key={uid}
                    column={column}
                    isVisible={!draft.hiddenColumnUids.includes(uid)}
                    isDisabled={isBusy}
                    canMoveUp={groupOrder.indexOf(uid) > 0}
                    canMoveDown={groupOrder.indexOf(uid) < groupOrder.length - 1}
                    onMove={(direction) => move(uid, direction)}
                    onVisibility={(checked) =>
                      setDraft((previous) => ({
                        ...previous,
                        hiddenColumnUids: checked
                          ? previous.hiddenColumnUids.filter((key) => key !== uid)
                          : [...previous.hiddenColumnUids, uid],
                      }))
                    }
                  />
                );
              })}
              {!columns.some(matchesSearch) && <Empty description="Поля не найдены" />}
            </SortableContext>
          </DndContext>
        )}
      </>
    );
  },
);
