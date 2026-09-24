/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export interface TextHttpRequest {
  method: 'GET';
  url: string;
  headers?: Record<string, string>;
}

export interface TextHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface TextHttpTransport {
  request(request: TextHttpRequest): Promise<TextHttpResponse>;
}
