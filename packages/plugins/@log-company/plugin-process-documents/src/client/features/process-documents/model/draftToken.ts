/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export const PROCESS_DOCUMENTS_DRAFT_FIELD = '_shipmentDocumentsDraftToken';
const STORAGE_KEY = 'log-company:shipment-documents:draft-token';

function isValidToken(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{16,120}$/.test(value);
}

function makeToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function getProcessDocumentsDraftToken() {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const token = window.sessionStorage.getItem(STORAGE_KEY);
  return isValidToken(token) ? token : undefined;
}

export function ensureProcessDocumentsDraftToken() {
  const existing = getProcessDocumentsDraftToken();
  if (existing) {
    return existing;
  }
  const token = makeToken();
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(STORAGE_KEY, token);
  }
  return token;
}

export function clearProcessDocumentsDraftToken(token?: string) {
  if (typeof window === 'undefined') {
    return;
  }
  const current = getProcessDocumentsDraftToken();
  if (!token || current === token) {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}
