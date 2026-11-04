/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DocumentIdentifier,
  DocumentRequestScope,
  DocumentsListResponse,
} from '../../../../contracts/processDocuments';
import type { ProcessDocumentsApi } from '../api/ProcessDocumentsApi';
import { getDocumentErrorText } from '../lib/errorText';

const empty: DocumentsListResponse = {
  breadcrumbs: [],
  folders: [],
  files: [],
  permissions: { canWrite: false, canDelete: false },
};

export function useDocumentsList(api: ProcessDocumentsApi, scope: DocumentRequestScope | null) {
  const scopeKey =
    scope?.shipmentId !== undefined ? `shipment:${scope.shipmentId}` : scope ? `draft:${scope.draftToken}` : '';
  const [location, setLocation] = useState<{ scopeKey: string; folderId: DocumentIdentifier | null }>({
    scopeKey: '',
    folderId: null,
  });
  const folderId = location.scopeKey === scopeKey ? location.folderId : null;
  const requestKey = JSON.stringify([scopeKey, folderId]);
  const [result, setResult] = useState<{ key: string; data: DocumentsListResponse }>({ key: '', data: empty });
  const [status, setStatus] = useState<{ key: string; loading: boolean; error: string | null }>({
    key: '',
    loading: false,
    error: null,
  });
  const generation = useRef(0);
  const activeRequestKey = useRef<string | null>(requestKey);
  const setFolderId = useCallback(
    (value: DocumentIdentifier | null) => setLocation({ scopeKey, folderId: value }),
    [scopeKey],
  );

  const load = useCallback(async () => {
    if (activeRequestKey.current !== requestKey) return;
    const current = ++generation.current;
    if (!scope) return;
    setStatus({ key: requestKey, loading: true, error: null });
    try {
      const data = await api.list(scope, folderId);
      if (current !== generation.current) return;
      setResult({ key: requestKey, data });
      setStatus({ key: requestKey, loading: false, error: null });
    } catch (error) {
      if (current !== generation.current) return;
      setStatus({
        key: requestKey,
        loading: false,
        error: getDocumentErrorText(error, 'Не удалось загрузить документы поставки'),
      });
    }
  }, [api, scope, folderId, requestKey]);

  useEffect(() => {
    activeRequestKey.current = requestKey;
    load();
    return () => {
      generation.current += 1;
      activeRequestKey.current = null;
    };
  }, [load, requestKey]);

  const data = result.key === requestKey ? result.data : empty;
  const currentStatus = status.key === requestKey ? status : { loading: !!scope, error: null };
  return {
    ...data,
    canWrite: !currentStatus.error && data.permissions.canWrite,
    canDelete: !currentStatus.error && data.permissions.canDelete,
    ...currentStatus,
    folderId,
    setFolderId,
    load,
  };
}
