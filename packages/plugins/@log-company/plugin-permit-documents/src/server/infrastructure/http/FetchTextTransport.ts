/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { RegistryError } from '../../domain/permit-document/RegistryErrors';
import type { TextHttpRequest, TextHttpResponse, TextHttpTransport } from './TextHttpTransport';

const REQUEST_TIMEOUT_MILLISECONDS = 15_000;
const MAXIMUM_ATTEMPTS = 3;
const RETRY_DELAYS_MILLISECONDS = [300, 1_000] as const;

export class FetchTextTransport implements TextHttpTransport {
  async request(request: TextHttpRequest): Promise<TextHttpResponse> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAXIMUM_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: { Accept: 'text/html,application/xhtml+xml', ...request.headers },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
        });
        const result: TextHttpResponse = {
          status: response.status,
          headers: this.headers(response.headers),
          body: await response.text(),
        };
        if (!this.isTemporaryStatus(result.status) || attempt === MAXIMUM_ATTEMPTS - 1) {
          return result;
        }
      } catch (error) {
        lastError = error;
        if (attempt === MAXIMUM_ATTEMPTS - 1) {
          break;
        }
      }
      await this.delay(RETRY_DELAYS_MILLISECONDS[attempt] || RETRY_DELAYS_MILLISECONDS[1]);
    }
    throw new RegistryError(
      'REGISTRY_TEMPORARY_UNAVAILABLE',
      lastError instanceof Error ? lastError.name : 'Network request failed.',
      true,
    );
  }

  private headers(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key.toLocaleLowerCase('en-US')] = value;
    });
    return result;
  }

  private isTemporaryStatus(status: number): boolean {
    return status === 408 || status === 429 || status >= 500;
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }
}
