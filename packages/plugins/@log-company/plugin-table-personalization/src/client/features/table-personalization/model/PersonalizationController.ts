/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { observable } from '@formily/reactive';
import type { ColumnSettings, TableIdentity, TablePersonalization } from '../../../../shared/contracts';
import { record } from '../../../../shared/contracts';
import type { PersonalizationApi } from '../api/TablePersonalizationApi';

export class PersonalizationController {
  readonly state = observable({
    data: null as TablePersonalization | null,
    isLoading: false,
    isSaving: false,
    error: '',
    widthError: '',
    isSavingWidth: false,
    previewWidths: {} as Record<string, number | null>,
  });
  private identity?: TableIdentity;
  private ownerKey = '';
  private generation = 0;
  private requestNumber = 0;
  private widthQueue: Promise<boolean> = Promise.resolve(true);
  private widthWrites = 0;
  private previewVersion = new Map<string, number>();

  constructor(
    private readonly api: PersonalizationApi,
    private readonly prepare?: (data: TablePersonalization, isCurrent: () => boolean) => Promise<void>,
    private readonly onStop?: () => void,
  ) {}

  matches(identity: TableIdentity, ownerKey: string): boolean {
    return ownerKey === this.ownerKey && JSON.stringify(identity) === JSON.stringify(this.identity);
  }

  async activate(identity: TableIdentity, ownerKey: string): Promise<void> {
    if (this.matches(identity, ownerKey)) return;
    this.stop();
    this.identity = identity;
    this.ownerKey = ownerKey;
    await this.reload();
  }

  stop(): void {
    this.generation++;
    this.identity = undefined;
    this.ownerKey = '';
    this.state.data = null;
    this.state.isLoading = false;
    this.state.isSaving = false;
    this.state.error = '';
    this.state.widthError = '';
    this.state.previewWidths = {};
    this.state.isSavingWidth = false;
    this.widthWrites = 0;
    this.previewVersion.clear();
    this.widthQueue = Promise.resolve(true);
    this.onStop?.();
  }

  async reload(waitForWidths = true): Promise<void> {
    const waitingGeneration = this.generation;
    if (waitForWidths && this.state.isSavingWidth) await this.widthQueue;
    if (waitingGeneration !== this.generation) return;
    if (!this.identity) return;
    const generation = this.generation;
    const request = ++this.requestNumber;
    this.state.isLoading = true;
    this.state.error = '';
    try {
      const data = await this.api.get(this.identity);
      const isCurrent = () => generation === this.generation && request === this.requestNumber;
      if (isCurrent()) {
        await this.prepare?.(data, isCurrent);
        if (isCurrent()) this.state.data = data;
      }
    } catch (error) {
      if (generation === this.generation && request === this.requestNumber) {
        this.state.error = 'Не удалось загрузить настройки столбцов. Повторите попытку';
      }
    } finally {
      if (generation === this.generation && request === this.requestNumber) this.state.isLoading = false;
    }
  }

  async save(settings: ColumnSettings): Promise<boolean> {
    return this.mutate(settings);
  }

  async reset(): Promise<boolean> {
    return this.mutate(null);
  }

  canResize(columnUid: string): boolean {
    const data = this.state.data;
    return Boolean(
      data &&
        !this.state.isLoading &&
        !this.state.isSaving &&
        (data.resizableColumnUids || data.columns.map((column) => column.uid)).includes(columnUid),
    );
  }

  getWidth(columnUid: string, defaultWidth: number): number {
    const preview = this.state.previewWidths[columnUid];
    return preview !== undefined
      ? preview ?? defaultWidth
      : this.state.data?.settings?.columnWidths?.[columnUid] ?? defaultWidth;
  }

  previewWidth(columnUid: string, width: number | null): void {
    this.previewVersion.set(columnUid, (this.previewVersion.get(columnUid) || 0) + 1);
    this.state.previewWidths[columnUid] = width;
  }

  cancelWidthPreview(columnUid: string): void {
    this.previewVersion.set(columnUid, (this.previewVersion.get(columnUid) || 0) + 1);
    delete this.state.previewWidths[columnUid];
  }

  changeWidth(columnUid: string, width: number | null): Promise<boolean> {
    if (!this.identity || !this.canResize(columnUid)) return Promise.resolve(false);
    const identity = this.identity;
    const generation = this.generation;
    this.previewWidth(columnUid, width);
    const version = this.previewVersion.get(columnUid);
    this.widthWrites++;
    this.state.isSavingWidth = true;
    this.state.widthError = '';
    const persist = async (): Promise<boolean> => {
      if (generation !== this.generation || !this.state.data) return false;
      try {
        const data = await this.api.width(identity, columnUid, width, this.state.data.schemaSignature);
        if (generation !== this.generation) return false;
        const previous = this.state.data.settings;
        if (
          JSON.stringify([previous?.columnOrder, previous?.hiddenColumnUids]) !==
          JSON.stringify([data.settings?.columnOrder, data.settings?.hiddenColumnUids])
        ) {
          await this.prepare?.(data, () => generation === this.generation);
          if (generation !== this.generation) return false;
        }
        this.state.data = data;
        return true;
      } catch (error) {
        if (generation !== this.generation) return false;
        if (record(record(error).response).status === 409) await this.reload(false);
        this.state.widthError = 'Не удалось сохранить ширину столбца. Повторите изменение';
        return false;
      } finally {
        if (generation === this.generation) {
          if (version === this.previewVersion.get(columnUid)) delete this.state.previewWidths[columnUid];
          this.widthWrites--;
          this.state.isSavingWidth = this.widthWrites > 0;
        }
      }
    };
    this.widthQueue = this.widthQueue.then(persist, persist);
    return this.widthQueue;
  }

  private async mutate(settings: ColumnSettings | null): Promise<boolean> {
    const waitingGeneration = this.generation;
    if (this.state.isSavingWidth) await this.widthQueue;
    if (waitingGeneration !== this.generation) return false;
    if (!this.identity || !this.state.data || this.state.isSaving || this.state.isLoading) return false;
    const generation = this.generation;
    const request = ++this.requestNumber;
    this.state.isSaving = true;
    this.state.error = '';
    try {
      const data = settings
        ? await this.api.save(this.identity, settings, this.state.data.schemaSignature)
        : await this.api.reset(this.identity);
      if (generation !== this.generation || request !== this.requestNumber) return false;
      const isCurrent = () => generation === this.generation && request === this.requestNumber;
      await this.prepare?.(data, isCurrent);
      if (!isCurrent()) return false;
      this.state.data = data;
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      if (record(record(error).response).status === 409) {
        await this.reload();
        this.state.error = 'Состав или права на столбцы изменились. Проверьте список и повторите сохранение';
      } else {
        this.state.error = 'Не удалось сохранить настройки столбцов. Изменения в окне сохранены';
      }
      return false;
    } finally {
      if (generation === this.generation) this.state.isSaving = false;
    }
  }
}
