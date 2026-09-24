/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/client';
import models from './features/process-documents/model';
import {
  clearProcessDocumentsDraftToken,
  getProcessDocumentsDraftToken,
  PROCESS_DOCUMENTS_DRAFT_FIELD,
} from './features/process-documents/model/draftToken';

interface RequestConfig {
  url?: unknown;
  method?: unknown;
  data?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isShipmentCreate(config: unknown): boolean {
  const request = asRecord(config) as RequestConfig;
  return (
    String(request.url || '').includes('shipments:create') && String(request.method || 'get').toLowerCase() === 'post'
  );
}

function parseRequestData(data: unknown): Record<string, unknown> {
  if (typeof data !== 'string') {
    return asRecord(data);
  }
  try {
    return asRecord(JSON.parse(data));
  } catch (error) {
    console.warn('[process-documents] Request data is not valid JSON', error);
    return {};
  }
}

function getConfigDraftToken(config: unknown): string | undefined {
  const token = parseRequestData((asRecord(config) as RequestConfig).data)[PROCESS_DOCUMENTS_DRAFT_FIELD];
  return typeof token === 'string' ? token : undefined;
}

export class PluginProcessDocumentsClient extends Plugin {
  private requestInterceptorId?: number;
  private responseInterceptorId?: number;

  async load(): Promise<void> {
    this.flowEngine.registerModels(models);
    this.removeInterceptors();

    this.requestInterceptorId = this.app.apiClient.axios.interceptors.request.use((config) => {
      if (!isShipmentCreate(config)) {
        return config;
      }
      const token = getProcessDocumentsDraftToken();
      if (!token) {
        return config;
      }
      const data = {
        ...parseRequestData(config.data),
        [PROCESS_DOCUMENTS_DRAFT_FIELD]: token,
      };
      config.data = typeof config.data === 'string' ? JSON.stringify(data) : data;
      return config;
    });

    this.responseInterceptorId = this.app.apiClient.axios.interceptors.response.use((response) => {
      if (isShipmentCreate(response.config)) {
        clearProcessDocumentsDraftToken(getConfigDraftToken(response.config));
      }
      return response;
    });
  }

  private removeInterceptors(): void {
    if (this.requestInterceptorId !== undefined) {
      this.app.apiClient.axios.interceptors.request.eject(this.requestInterceptorId);
      this.requestInterceptorId = undefined;
    }
    if (this.responseInterceptorId !== undefined) {
      this.app.apiClient.axios.interceptors.response.eject(this.responseInterceptorId);
      this.responseInterceptorId = undefined;
    }
  }
}

export default PluginProcessDocumentsClient;
