/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { observable } from '@formily/reactive';
import type { TableIdentity } from '../../../../shared/contracts';
import { record } from '../../../../shared/contracts';
import type {
  FilterTemplateInput,
  FilterTemplateList,
  FilterTemplateOperation,
  SavedFilter,
  TableTemplateSnapshot,
} from '../../../../shared/filterTemplates';
import type { FilterTemplateApi } from '../api/FilterTemplateApi';

function errorMessage(error: unknown): string {
  const response = record(record(error).response);
  const errors = record(response.data).errors;
  const message = Array.isArray(errors) && record(errors[0]).message;
  return typeof message === 'string' && message.length < 300
    ? message
    : 'Не удалось обработать шаблоны таблицы. Повторите попытку';
}

function isCompleteFilter(filter: SavedFilter | undefined): boolean {
  return Boolean(
    filter &&
      filter.items.every((item) =>
        'items' in item
          ? isCompleteFilter(item)
          : item.path && item.operator && (item.noValue || item.value !== undefined),
      ),
  );
}

export class FilterTemplatesController {
  readonly state = observable({
    data: null as FilterTemplateList | null,
    isLoading: false,
    isSaving: false,
    isApplying: false,
    selectedTemplateId: undefined as string | undefined,
    error: '',
  });
  private identity?: TableIdentity;
  private ownerKey = '';
  private generation = 0;
  private requestNumber = 0;

  constructor(private readonly api: FilterTemplateApi) {}

  matches(identity: TableIdentity, ownerKey: string): boolean {
    return JSON.stringify(identity) === JSON.stringify(this.identity) && this.ownerKey === ownerKey;
  }

  async activate(identity: TableIdentity, ownerKey: string): Promise<void> {
    if (!this.matches(identity, ownerKey)) {
      this.stop();
      this.identity = identity;
      this.ownerKey = ownerKey;
    }
    await this.reload();
  }

  stop(): void {
    this.generation++;
    this.identity = undefined;
    this.ownerKey = '';
    this.state.data = null;
    this.state.isLoading = false;
    this.state.isSaving = false;
    this.state.isApplying = false;
    this.state.selectedTemplateId = undefined;
    this.state.error = '';
  }

  async reload(): Promise<void> {
    if (!this.identity || this.state.isSaving) return;
    const generation = this.generation;
    const request = ++this.requestNumber;
    this.state.isLoading = true;
    this.state.error = '';
    try {
      const data = await this.api.request('list', { identity: this.identity });
      if (generation === this.generation && request === this.requestNumber) this.state.data = data;
    } catch (error) {
      if (generation === this.generation && request === this.requestNumber) {
        this.state.data = null;
        this.state.error = errorMessage(error);
      }
    } finally {
      if (generation === this.generation && request === this.requestNumber) this.state.isLoading = false;
    }
  }

  async mutate(
    operation: Exclude<FilterTemplateOperation, 'list'>,
    input: Omit<FilterTemplateInput, 'identity'>,
    capture?: () => Promise<TableTemplateSnapshot>,
  ): Promise<boolean> {
    if (!this.identity || !this.state.data || this.state.isLoading || this.state.isSaving || this.state.isApplying)
      return false;
    const generation = this.generation;
    this.state.isSaving = true;
    this.state.error = '';
    try {
      const snapshot = capture ? await capture() : undefined;
      if (generation !== this.generation) return false;
      const values = { ...input, ...snapshot };
      if (
        (operation === 'create' || operation === 'update') &&
        (!isCompleteFilter(values.filter) || !values.columnSettings)
      ) {
        this.state.error = 'Заполните все условия фильтра и загрузите настройки колонок';
        return false;
      }
      const data = await this.api.request(operation, {
        identity: this.identity,
        ...values,
        ...(operation === 'create' || operation === 'update'
          ? { schemaSignature: this.state.data.schemaSignature }
          : {}),
      });
      if (generation !== this.generation) return false;
      this.state.data = data;
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      this.state.error = errorMessage(error);
      return false;
    } finally {
      if (generation === this.generation) this.state.isSaving = false;
    }
  }
  async apply(id: string | undefined, operation: () => Promise<boolean>): Promise<boolean> {
    if (this.state.isSaving || this.state.isLoading || this.state.isApplying || !this.state.data) return false;
    const generation = this.generation;
    this.state.isApplying = true;
    this.state.error = '';
    try {
      const success = await operation();
      if (generation !== this.generation) return false;
      if (success) this.state.selectedTemplateId = id;
      return success;
    } catch (error) {
      if (generation === this.generation)
        this.state.error = 'Не удалось применить шаблон. Обновите список и повторите попытку';
      return false;
    } finally {
      if (generation === this.generation) this.state.isApplying = false;
    }
  }
}
