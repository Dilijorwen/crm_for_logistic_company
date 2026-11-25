/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';
import type { FormDocumentSaveTarget } from '../../../../contracts/processDocuments';

export interface SelectedDocument {
  file: File;
  name: string;
}

export interface FormDocumentBatch {
  token: string;
  files: { name: string; size: number }[];
  emptyFolders?: string[];
}

export class FormDocumentDraftsApi {
  constructor(private readonly client: APIClient) {}

  async folderPermissions(resource: 'shipments' | 'transport_runs', recordId: string | null, companyId?: string) {
    const { data } = await this.client.request<{ data: { canRead: boolean; canWrite: boolean } }>({
      url: 'processDocumentDrafts:shipmentPermissions',
      method: 'post',
      params: { resource, recordId, companyId },
    });
    if (typeof data.data?.canRead !== 'boolean' || typeof data.data.canWrite !== 'boolean') {
      throw new Error('Сервер не вернул права на документы.');
    }
    return data.data;
  }

  async stage(
    form: FormDocumentSaveTarget,
    files: SelectedDocument[],
    folderId?: string | number | null,
    emptyFolders?: string[],
    companyId?: string,
  ) {
    const data = new FormData();
    files.forEach(({ file, name }) => data.append('files', file, name));
    if (emptyFolders?.length) data.append('emptyFolders', JSON.stringify(emptyFolders));
    const response = await this.client.request<{ data: FormDocumentBatch }>({
      url: 'processDocumentDrafts:stage',
      method: 'post',
      params: { ...form, ...(folderId != null && { folderId }), ...(companyId && { companyId }) },
      data,
    });
    return response.data.data;
  }

  async discard(tokens: string[]): Promise<void> {
    if (!tokens.length) return;
    await this.client.request({ url: 'processDocumentDrafts:discard', method: 'post', data: { tokens } });
  }
}
