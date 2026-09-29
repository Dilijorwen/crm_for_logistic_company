/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { SearchOutlined } from '@ant-design/icons';
import { ActionModel, ActionSceneEnum } from '@nocobase/client';
import { useFlowSettingsContext } from '@nocobase/flow-engine';
import { App, Input, Spin, Transfer } from 'antd';
import type { InputRef } from 'antd';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  type IndexedSearchTableResource,
  MINIMUM_SEARCH_LENGTH,
  SEARCH_DEBOUNCE_MS,
  TableIndexedSearchController,
} from '../lib/TableIndexedSearchController';

interface CollectionSearchActionProps {
  searchPlaceholder?: string;
  searchWidth?: number;
  searchableFieldNames?: string[];
}

interface SearchFieldOption {
  key: string;
  title: string;
}

interface SearchFieldsCollection {
  getFields(): unknown[];
}

interface SearchFieldsTransferProps {
  value?: React.Key[];
  onChange?: (value: React.Key[]) => void;
}

const SEARCHABLE_SCALAR_TYPES = new Set([
  'string',
  'text',
  'uid',
  'nanoid',
  'uuid',
  'integer',
  'bigInt',
  'float',
  'double',
  'real',
  'decimal',
  'date',
  'dateOnly',
  'datetime',
  'datetimeTz',
  'datetimeNoTz',
  'time',
  'unixTimestamp',
  'boolean',
]);
const EXCLUDED_FIELD_INTERFACES = new Set(['attachment', 'file', 'password', 'sequence', 'snowflakeId', 'sort']);

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizedConfiguredFields(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return Array.from(new Set(value.filter((field): field is string => typeof field === 'string' && Boolean(field))));
}

export function resolveSearchInputValue(draftValue: string | undefined, resourceValue: unknown): string {
  return draftValue ?? (typeof resourceValue === 'string' ? resourceValue : '');
}

function sameConfiguredFields(left: string[] | undefined, right: string[] | undefined): boolean {
  if (!left || !right) {
    return left === right;
  }
  return left.length === right.length && left.every((field, index) => field === right[index]);
}

export function getConfigurableSearchFields(collection: unknown): SearchFieldOption[] {
  const candidate = collection as Partial<SearchFieldsCollection> | null | undefined;
  if (typeof candidate?.getFields !== 'function') {
    return [];
  }
  return candidate
    .getFields()
    .map(asRecord)
    .filter((field) => {
      const fieldType = typeof field.type === 'string' ? field.type : '';
      const fieldInterface = typeof field.interface === 'string' ? field.interface : '';
      return (
        typeof field.name === 'string' &&
        !field.primaryKey &&
        !field.isForeignKey &&
        !EXCLUDED_FIELD_INTERFACES.has(fieldInterface) &&
        (SEARCHABLE_SCALAR_TYPES.has(fieldType) || typeof field.target === 'string')
      );
    })
    .map((field) => {
      const uiSchema = asRecord(field.uiSchema);
      return {
        key: String(field.name),
        title: String(uiSchema.title || field.title || field.name),
      };
    });
}

function SearchFieldsTransfer(props: SearchFieldsTransferProps) {
  const { model } = useFlowSettingsContext();
  const options = getConfigurableSearchFields(model?.context?.blockModel?.collection);
  return (
    <Transfer<SearchFieldOption>
      dataSource={options}
      listStyle={{ width: 280, height: 360 }}
      render={(item) => item.title}
      showSearch
      targetKeys={props.value || []}
      onChange={(nextKeys) => props.onChange?.(nextKeys)}
    />
  );
}

function tableResource(model: CollectionSearchActionModel): IndexedSearchTableResource | null {
  const resource = model.context.blockModel?.resource as unknown;
  if (!resource || typeof resource !== 'object') {
    return null;
  }
  const candidate = resource as Partial<IndexedSearchTableResource>;
  return typeof candidate.runAction === 'function' && typeof candidate.setRefreshAction === 'function'
    ? (candidate as IndexedSearchTableResource)
    : null;
}

function CollectionSearchAction({ model }: { model: CollectionSearchActionModel }) {
  const { message } = App.useApp();
  const resource = tableResource(model);
  const props = model.props as typeof model.props & CollectionSearchActionProps;
  const configuredFields = normalizedConfiguredFields(props.searchableFieldNames);
  const stableConfiguredFields = useRef(configuredFields);
  if (!sameConfiguredFields(stableConfiguredFields.current, configuredFields)) {
    stableConfiguredFields.current = configuredFields;
  }
  const searchableFieldNames = stableConfiguredFields.current;
  const inputRef = useRef<InputRef>(null);
  const [term, setTerm] = useState(() =>
    resolveSearchInputValue(model.searchInputDraft, resource?.getRequestParameter('searchTerm')),
  );
  const [loading, setLoading] = useState(false);
  const controller = useMemo(
    () =>
      resource
        ? new TableIndexedSearchController(
            resource,
            ({ loading: nextLoading, error }) => {
              setLoading(nextLoading);
              if (error) {
                message.error('Не удалось выполнить поиск');
              }
            },
            SEARCH_DEBOUNCE_MS,
            { searchableFieldNames },
          )
        : null,
    [message, resource, searchableFieldNames],
  );

  useEffect(() => {
    return () => controller?.dispose();
  }, [controller]);

  useLayoutEffect(() => {
    if (model.isSearchInputFocused) {
      inputRef.current?.focus({ cursor: 'end' });
    }
  }, [model]);

  if (!controller) {
    return null;
  }

  const handleSubmit = async (): Promise<void> => {
    await controller.submit(term);
  };
  return (
    <Input
      ref={inputRef}
      allowClear
      aria-label="Поиск по текущей коллекции"
      prefix={<SearchOutlined aria-hidden />}
      placeholder={props.searchPlaceholder || 'Поиск по всем данным'}
      status={term.trim().length > 0 && term.trim().length < MINIMUM_SEARCH_LENGTH ? 'warning' : undefined}
      style={{ width: props.searchWidth || 280 }}
      value={term}
      onChange={(event) => {
        const value = event.target.value;
        model.searchInputDraft = value;
        setTerm(value);
        controller.schedule(value);
      }}
      onPressEnter={handleSubmit}
      onFocus={() => {
        model.isSearchInputFocused = true;
      }}
      onBlur={() => {
        model.isSearchInputFocused = false;
      }}
      suffix={
        <span style={{ display: 'inline-flex', justifyContent: 'center', width: 14 }}>
          {loading ? <Spin size="small" aria-label="Поиск выполняется" /> : null}
        </span>
      }
    />
  );
}

export class CollectionSearchActionModel extends ActionModel {
  static scene = ActionSceneEnum.collection;

  declare props: ActionModel['props'] & CollectionSearchActionProps;

  isSearchInputFocused = false;
  searchInputDraft?: string;

  enableEditTooltip = false;
  enableEditTitle = false;
  enableEditIcon = false;
  enableEditType = false;
  enableEditDanger = false;

  defaultProps: ActionModel['defaultProps'] & CollectionSearchActionProps = {
    searchPlaceholder: 'Поиск по всем данным',
    searchWidth: 280,
  };

  getAclActionName() {
    return 'list';
  }

  render() {
    return <CollectionSearchAction model={this} />;
  }
}

CollectionSearchActionModel.define({
  label: 'Поиск по коллекции',
  sort: 80,
});

CollectionSearchActionModel.registerFlow({
  key: 'collectionSearchSettings',
  title: 'Настройки поиска',
  steps: {
    appearance: {
      title: 'Строка поиска',
      uiSchema: {
        searchPlaceholder: {
          type: 'string',
          title: 'Подсказка в строке поиска',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
        },
        searchWidth: {
          type: 'number',
          title: 'Ширина строки поиска',
          'x-decorator': 'FormItem',
          'x-component': 'InputNumber',
          'x-component-props': { min: 200, max: 600, step: 20 },
        },
      },
      defaultParams(ctx) {
        return {
          searchPlaceholder: ctx.model.props.searchPlaceholder || 'Поиск по всем данным',
          searchWidth: ctx.model.props.searchWidth || 280,
        };
      },
      handler(ctx, params) {
        ctx.model.setProps({
          searchPlaceholder:
            typeof params.searchPlaceholder === 'string' ? params.searchPlaceholder : 'Поиск по всем данным',
          searchWidth: typeof params.searchWidth === 'number' ? params.searchWidth : 280,
        });
      },
    },
    searchableFields: {
      title: 'Поля поиска',
      uiSchema: {
        searchableFieldNames: {
          type: 'array',
          title: 'Поиск выполняется по выбранным полям',
          required: true,
          'x-decorator': 'FormItem',
          'x-component': SearchFieldsTransfer,
        },
      },
      defaultParams(ctx) {
        const configured = normalizedConfiguredFields(ctx.model.props.searchableFieldNames);
        return {
          searchableFieldNames:
            configured ?? getConfigurableSearchFields(ctx.blockModel?.collection).map((field) => field.key),
        };
      },
      handler(ctx, params) {
        ctx.model.setProps({
          searchableFieldNames: normalizedConfiguredFields(params.searchableFieldNames) || [],
        });
      },
    },
  },
});
