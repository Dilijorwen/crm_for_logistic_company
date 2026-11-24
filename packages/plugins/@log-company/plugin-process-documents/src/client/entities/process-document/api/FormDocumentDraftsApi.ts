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
}

export class FormDocumentDraftsApi {
  constructor(private readonly client: APIClient) {}

  async stage(form: FormDocumentSaveTarget, files: SelectedDocument[]) {
    const data = new FormData();
    files.forEach(({ file, name }) => data.append('files', file, name));
    const response = await this.client.request<{ data: FormDocumentBatch }>({
      url: 'processDocumentDrafts:stage',
      method: 'post',
      params: form,
      data,
    });
    return response.data.data;
  }

  async discard(tokens: string[]): Promise<void> {
    if (!tokens.length) return;
    await this.client.request({ url: 'processDocumentDrafts:discard', method: 'post', data: { tokens } });
  }
}
