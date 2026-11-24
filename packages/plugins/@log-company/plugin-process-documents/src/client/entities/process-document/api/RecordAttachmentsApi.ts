/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';
import { PERMIT_DOCUMENT_FOLDERS_META } from '../../../../contracts/processDocuments';
import { catalogIdentifier, type CatalogId } from './DocumentsCatalogApi';

export interface RecordAttachmentField {
  name: string;
  title: string;
  multiple: boolean;
  readOnly: boolean;
}

export interface RecordAttachment {
  id: CatalogId;
  title: string;
  url: string | undefined;
  file_size?: number;
  author?: string;
  createdAt?: string;
  folders?: string[];
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export class RecordAttachmentsApi {
  constructor(
    private readonly api: APIClient,
    private readonly collection: string,
    private readonly recordId: string | number,
    private readonly fieldName: string,
    private readonly multiple: boolean,
    private readonly dataSourceKey: string,
  ) {}

  private get headers() {
    return { 'X-Data-Source': this.dataSourceKey };
  }

  async load() {
    const permissions = await this.sectionPermissions();
    if (permissions?.canRead === false) return { files: [], canUpdate: false, canDelete: false, hidden: true };
    const { data } = await this.api
      .resource(this.collection, undefined, {
        ...this.headers,
        'X-With-ACL-Meta': true,
      })
      .get({
        filterByTk: this.recordId,
        appends: [
          this.fieldName,
          ...(this.collection === 'contracts'
            ? [`${this.fieldName}.createdBy.nickname`, `${this.fieldName}.createdBy.username`]
            : []),
        ],
      });
    const result = object(data);
    const record = object(result.data);
    if (!(this.fieldName in record)) throw new Error('Нет доступа к полю вложений этой записи.');
    const allowedUpdates = object(object(result.meta).allowedActions).update;
    const canUpdate =
      Array.isArray(allowedUpdates) && allowedUpdates.some((id: unknown) => String(id) === String(this.recordId));
    const fieldValue = record[this.fieldName];
    const files: RecordAttachment[] = (Array.isArray(fieldValue) ? fieldValue : [fieldValue]).flatMap((value) => {
      const item = object(value);
      const id = catalogIdentifier(item.id);
      if (id === undefined) return [];
      const filename = item.title ?? item.filename;
      const title = typeof filename === 'string' && filename ? filename : 'Документ';
      const extension = typeof item.extname === 'string' && /^\.[a-z0-9]+$/i.test(item.extname) ? item.extname : '';
      const folders = object(item.meta)[PERMIT_DOCUMENT_FOLDERS_META];
      const creator = object(item.createdBy);
      const author = creator.nickname || creator.username;
      const hasFolders =
        this.collection === 'permit_documents' &&
        this.fieldName === 'documents' &&
        Array.isArray(folders) &&
        folders.length > 0 &&
        folders.length < 20 &&
        folders.every(
          (name): name is string =>
            typeof name === 'string' && name.trim().length > 0 && name.length <= 200 && !name.includes('/'),
        );
      return [
        {
          id,
          title: title.toLowerCase().endsWith(extension.toLowerCase()) ? title : title + extension,
          url: typeof item.url === 'string' ? item.url : undefined,
          ...(typeof item.size === 'number' && { file_size: item.size }),
          ...(typeof item.createdAt === 'string' && { createdAt: item.createdAt }),
          ...(typeof author === 'string' && { author }),
          ...(hasFolders && { folders }),
        },
      ];
    });
    return {
      files,
      canUpdate: canUpdate && permissions?.canWrite !== false,
      canDelete: canUpdate && permissions?.canDelete !== false,
    };
  }

  private async sectionPermissions() {
    const resource = `${this.collection}.${this.fieldName}`;
    if (
      this.dataSourceKey !== 'main' ||
      !['our_companies.documents', 'permit_documents.documents', 'contracts.documents'].includes(resource)
    )
      return;
    const { data } = await this.api.request({
      url: 'processDocuments:attachmentPermissions',
      method: 'post',
      data: { resource, recordId: this.recordId },
      headers: this.headers,
    });
    const result = object(object(data).data ?? data);
    if (
      typeof result.canRead !== 'boolean' ||
      typeof result.canWrite !== 'boolean' ||
      typeof result.canDelete !== 'boolean'
    ) {
      throw new Error('Сервер не вернул права на документы.');
    }
    return { canRead: result.canRead, canWrite: result.canWrite, canDelete: result.canDelete };
  }

  async upload(file: File): Promise<CatalogId> {
    const body = new FormData();
    body.append('file', file);
    const { data } = await this.api.request({
      url: 'attachments:create',
      method: 'post',
      params: { attachmentField: `${this.collection}.${this.fieldName}` },
      headers: this.headers,
      data: body,
    });
    const id = catalogIdentifier(object(object(data).data).id);
    if (id === undefined) throw new Error('Сервер не вернул идентификатор загруженного файла.');
    return id;
  }

  async link(id: CatalogId): Promise<void> {
    if (this.multiple) {
      await this.api
        .resource(`${this.collection}.${this.fieldName}`, this.recordId, this.headers)
        .add({ values: [id] });
    } else {
      await this.setSingle(id);
    }
  }

  async deleteFile(id: CatalogId): Promise<void> {
    await this.api.request({
      url: 'processDocuments:deleteAttachment',
      method: 'post',
      headers: this.headers,
      data: { collection: this.collection, recordId: this.recordId, field: this.fieldName, attachmentId: id },
    });
  }

  async open(id: CatalogId, signal?: AbortSignal): Promise<Blob> {
    const { files } = await this.load();
    const url = files.find((file) => file.id === id)?.url;
    if (!url) throw new Error('Ссылка на файл недоступна.');
    const target = new URL(url, window.location.origin);
    if (target.origin !== window.location.origin) throw new Error('Недопустимый адрес файла.');
    const response = await fetch(target, { mode: 'same-origin', redirect: 'error', signal });
    if (!response.ok) throw new Error('Не удалось загрузить файл.');
    return response.blob();
  }

  private async setSingle(id: CatalogId): Promise<void> {
    await this.api.resource(this.collection, undefined, this.headers).update({
      filterByTk: this.recordId,
      values: { [this.fieldName]: id },
    });
  }
}
