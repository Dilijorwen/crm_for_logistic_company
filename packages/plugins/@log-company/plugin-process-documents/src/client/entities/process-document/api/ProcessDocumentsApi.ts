/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type {
  DocumentIdentifier,
  DocumentRequestScope,
  DocumentsListResponse,
  FolderDeleteSummary,
} from '../../../../contracts/processDocuments';

export interface ProcessDocumentsTransport {
  request(config: { url: string; method: 'post'; data: unknown }): Promise<unknown>;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function responseData(response: unknown): Record<string, unknown> {
  const outer = record(response);
  const data = outer.data;
  return record(record(data).data ?? data ?? response);
}

function isDocument(value: unknown): value is DocumentsListResponse['folders'][number] {
  const item = record(value);
  return (typeof item.id === 'string' || typeof item.id === 'number') && typeof item.title === 'string';
}

export class ProcessDocumentsApi {
  constructor(private readonly transport: ProcessDocumentsTransport) {}

  async list(scope: DocumentRequestScope, folderId: DocumentIdentifier | null): Promise<DocumentsListResponse> {
    const data = responseData(await this.request('list', { ...scope, folderId }));
    if (
      !Array.isArray(data.breadcrumbs) ||
      !data.breadcrumbs.every(isDocument) ||
      !Array.isArray(data.folders) ||
      !data.folders.every(isDocument) ||
      !Array.isArray(data.files) ||
      !data.files.every(isDocument) ||
      typeof record(data.permissions).canWrite !== 'boolean' ||
      typeof record(data.permissions).canDelete !== 'boolean'
    )
      throw new Error('Сервер вернул некорректный список документов');
    return {
      breadcrumbs: data.breadcrumbs,
      folders: data.folders,
      files: data.files,
      permissions: {
        canWrite: record(data.permissions).canWrite === true,
        canDelete: record(data.permissions).canDelete === true,
      },
    };
  }

  async upload(
    scope: DocumentRequestScope,
    folderId: DocumentIdentifier | null,
    files: readonly File[],
  ): Promise<void> {
    if (!files.length) return;
    const data = new FormData();
    if (scope.shipmentId !== undefined) data.append('shipmentId', String(scope.shipmentId));
    else data.append('draftToken', scope.draftToken);
    if (folderId !== null) data.append('folderId', String(folderId));
    for (const file of files) data.append('files', file, file.webkitRelativePath || file.name);
    await this.request('uploadFiles', data);
  }

  async deleteFile(documentId: DocumentIdentifier, draftToken?: string): Promise<void> {
    await this.request('deleteFile', { documentId, draftToken });
  }

  async folderDeleteSummary(folderId: DocumentIdentifier, draftToken?: string): Promise<FolderDeleteSummary> {
    const data = responseData(await this.request('folderDeleteSummary', { folderId, draftToken }));
    if (
      typeof data.folders !== 'number' ||
      typeof data.files !== 'number' ||
      !Number.isSafeInteger(data.folders) ||
      !Number.isSafeInteger(data.files) ||
      data.folders < 0 ||
      data.files < 0
    ) {
      throw new Error('Сервер вернул некорректное содержимое папки');
    }
    return { folders: data.folders, files: data.files };
  }

  async deleteFolder(folderId: DocumentIdentifier, draftToken?: string): Promise<void> {
    await this.request('deleteFolder', { folderId, draftToken });
  }

  private request(action: string, data: unknown): Promise<unknown> {
    return this.transport.request({ url: `processDocuments:${action}`, method: 'post', data });
  }
}
