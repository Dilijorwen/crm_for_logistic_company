/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';
import { catalogIdentifier, permitCatalogFolders, runCatalogFolders, runCatalogTitle } from './catalogFolders';

export { catalogIdentifier };

import type { CatalogFolder, CatalogId, CatalogItem } from '../../../../contracts/documentCatalog';
export type { CatalogFolder, CatalogId, CatalogItem } from '../../../../contracts/documentCatalog';

export type CatalogQuery =
  | { kind: 'companies'; runId?: CatalogId }
  | { kind: 'runs'; companyId: CatalogId }
  | { kind: 'shipments'; companyId: CatalogId; runId?: CatalogId }
  | { kind: 'shipments'; companyId?: undefined; runId: CatalogId }
  | { kind: 'permits'; companyId: CatalogId }
  | { kind: 'contracts'; companyId: CatalogId; active: boolean }
  | { kind: 'permitAttachments'; permitIds: CatalogId[] }
  | { kind: 'attachments'; permitId: CatalogId }
  | { kind: 'companyAttachments'; companyId: CatalogId };

type AttachmentQuery = Extract<CatalogQuery, { kind: 'attachments' | 'companyAttachments' }>;

export const catalogPageSize = 25;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function queryOptions(query: Exclude<CatalogQuery, { kind: 'permitAttachments' }>) {
  switch (query.kind) {
    case 'companies':
      return {
        resource: 'our_companies',
        label: 'name',
        filter: query.runId ? { 'shipments.runs.id': query.runId } : undefined,
      };
    case 'runs':
      return { resource: 'transport_runs', label: 'run_number', filter: { 'shipments.company_id': query.companyId } };
    case 'shipments':
      return {
        resource: 'shipments',
        label: 'shipment_number',
        filter: {
          ...(query.companyId !== undefined && { company_id: query.companyId }),
          'runs.id': query.runId ?? null,
        },
      };
    case 'permits':
      return { resource: 'permit_documents', label: 'title', filter: { company_id: query.companyId } };
    case 'contracts':
      return {
        resource: 'contracts',
        label: 'name',
        filter: {
          'importers.id': query.companyId,
          ...(query.active ? { is_active: true } : { $or: [{ is_active: false }, { is_active: null }] }),
        },
      };
    case 'attachments':
      return { resource: 'permit_documents.documents', label: 'title', parentId: query.permitId };
    case 'companyAttachments':
      return { resource: 'our_companies.documents', label: 'title', parentId: query.companyId };
  }
}

export class DocumentsCatalogApi {
  constructor(private readonly api: APIClient) {}

  async folders(kind: 'runs' | 'permits', companyId: CatalogId): Promise<CatalogFolder[]> {
    const resource = queryOptions({ kind, companyId });
    const rows: Record<string, unknown>[] = [];
    const pageSize = 100;
    for (let page = 1; ; page++) {
      const response = await this.api.resource(resource.resource).list({
        page,
        pageSize,
        sort: ['id'],
        filter: resource.filter,
        ...(kind === 'runs'
          ? { fields: ['id', 'run_number'], appends: ['shipments.createdAt', 'vehicle.registration_number'] }
          : { fields: ['id', 'status', 'internal_number', 'document_type'] }),
      });
      const data = record(response.data);
      if (!Array.isArray(data.data)) throw new Error('Сервер вернул некорректный список.');
      rows.push(...data.data.map(record));
      const count = record(data.meta).count;
      if (!data.data.length || (typeof count === 'number' ? rows.length >= count : data.data.length < pageSize)) break;
    }
    return kind === 'runs' ? runCatalogFolders(rows) : permitCatalogFolders(rows);
  }

  async list(query: CatalogQuery, page: number): Promise<{ rows: CatalogItem[]; total: number }> {
    if (query.kind === 'permitAttachments') {
      const files: CatalogItem[] = [];
      for (const permitId of query.permitIds) {
        for (let attachmentPage = 1; ; attachmentPage++) {
          const { rows, total } = await this.list({ kind: 'attachments', permitId }, attachmentPage);
          files.push(...rows.map((file) => ({ ...file, attachmentOwnerId: permitId })));
          if (!rows.length || attachmentPage * catalogPageSize >= total) break;
        }
      }
      const uniqueFiles = [...new Map(files.map((file) => [String(file.id), file])).values()];
      return {
        rows: uniqueFiles.slice((page - 1) * catalogPageSize, page * catalogPageSize),
        total: uniqueFiles.length,
      };
    }
    const options = queryOptions(query);
    const isAttachment = query.kind === 'attachments' || query.kind === 'companyAttachments';
    const response = await this.api.resource(options.resource, options.parentId).list({
      page,
      pageSize: catalogPageSize,
      sort: [options.label, 'id'],
      filter: options.filter,
      ...(isAttachment ? {} : { fields: ['id', options.label, 'createdAt'] }),
      appends: [
        'createdBy.nickname',
        'createdBy.username',
        ...(query.kind === 'runs' ? ['vehicle.registration_number'] : []),
      ],
    });
    const data = record(response.data);
    if (!Array.isArray(data.data)) throw new Error('Сервер вернул некорректный список.');
    const rows = data.data.flatMap((value) => {
      const item = record(value);
      const id = catalogIdentifier(item.id);
      if (id === undefined) return [];
      const creator = record(item.createdBy);
      const author = creator.nickname || creator.username;
      const metadata = {
        ...(typeof item.createdAt === 'string' && { createdAt: item.createdAt }),
        ...(typeof author === 'string' && { author }),
        ...(typeof item.size === 'number' && { file_size: item.size }),
      };
      if (query.kind === 'runs') return [{ id, title: runCatalogTitle(item, id), ...metadata }];
      const name = item[options.label] ?? (isAttachment ? item.filename : undefined);
      const prefix = query.kind === 'shipments' ? 'Поставка №' : '';
      const title = typeof name === 'string' || typeof name === 'number' ? `${prefix}${name}` : String(id);
      const extension = isAttachment && typeof item.extname === 'string' ? item.extname : '';
      return [
        { id, title: title.toLowerCase().endsWith(extension.toLowerCase()) ? title : title + extension, ...metadata },
      ];
    });
    const count = record(data.meta).count;
    return { rows, total: typeof count === 'number' ? count : rows.length };
  }

  async attachmentDownload(query: AttachmentQuery, attachmentId: CatalogId): Promise<string> {
    const { resource, parentId } = queryOptions(query);
    const response = await this.api.resource(resource, parentId).get({ filterByTk: attachmentId });
    const url = record(record(response.data).data).url;
    if (typeof url !== 'string' || !url) throw new Error('Ссылка на файл недоступна.');
    const target = new URL(url, window.location.origin);
    if (target.protocol !== 'https:' && target.protocol !== 'http:') throw new Error('Недопустимый адрес файла.');
    return target.href;
  }
}
