/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { RegistryError } from '../../domain/permit-document/RegistryErrors';
import type { JsonHttpTransport } from '../http/JsonHttpTransport';

interface CachedToken {
  value: string;
  expiresAtMilliseconds: number;
}

const EXPIRY_SAFETY_WINDOW_MILLISECONDS = 60_000;

export class FsaAuthTokenProvider {
  private cachedToken: CachedToken | null = null;
  private loginPromise: Promise<CachedToken> | null = null;

  constructor(
    private readonly transport: JsonHttpTransport,
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly password: string,
  ) {}

  async getToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.isUsable(this.cachedToken)) {
      return this.cachedToken.value;
    }
    if (forceRefresh) {
      this.cachedToken = null;
    }
    if (!this.loginPromise) {
      this.loginPromise = this.login();
    }
    try {
      this.cachedToken = await this.loginPromise;
      return this.cachedToken.value;
    } finally {
      this.loginPromise = null;
    }
  }

  invalidate(): void {
    this.cachedToken = null;
  }

  private async login(): Promise<CachedToken> {
    if (this.username.trim().length === 0 || this.password.length === 0) {
      throw new RegistryError('REGISTRY_NOT_CONFIGURED', 'FSA credentials are not configured.', false);
    }
    const response = await this.transport.request({
      method: 'POST',
      url: `${this.baseUrl}/login`,
      body: { username: this.username, password: this.password },
    });
    if (response.status < 200 || response.status >= 300) {
      throw new RegistryError('REGISTRY_AUTHENTICATION_FAILED', 'FSA login failed.', false);
    }
    const authorization = response.headers.authorization;
    const match = typeof authorization === 'string' ? /^Bearer\s+(.+)$/i.exec(authorization.trim()) : null;
    if (!match) {
      throw new RegistryError('INVALID_REGISTRY_RESPONSE', 'FSA login response has no Bearer token.', false);
    }
    return { value: match[1], expiresAtMilliseconds: this.jwtExpiry(match[1]) };
  }

  private jwtExpiry(token: string): number {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) {
      return Date.now() + 5 * 60_000;
    }
    try {
      const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as unknown;
      if (payload !== null && typeof payload === 'object' && typeof (payload as { exp?: unknown }).exp === 'number') {
        return (payload as { exp: number }).exp * 1_000;
      }
    } catch {
      return Date.now() + 5 * 60_000;
    }
    return Date.now() + 5 * 60_000;
  }

  private isUsable(token: CachedToken | null): token is CachedToken {
    return token !== null && token.expiresAtMilliseconds - EXPIRY_SAFETY_WINDOW_MILLISECONDS > Date.now();
  }
}
