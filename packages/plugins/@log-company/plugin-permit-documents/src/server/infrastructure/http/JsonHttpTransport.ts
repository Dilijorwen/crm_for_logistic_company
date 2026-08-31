/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export interface JsonHttpRequest {
  method: 'GET' | 'POST';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface JsonHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface JsonHttpTransport {
  request(request: JsonHttpRequest): Promise<JsonHttpResponse>;
}
