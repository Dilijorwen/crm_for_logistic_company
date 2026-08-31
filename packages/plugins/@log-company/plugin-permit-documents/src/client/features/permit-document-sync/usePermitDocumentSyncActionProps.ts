/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useAPIClient, useDataBlockRequestGetter, useRecord } from '@nocobase/client';
import { App } from 'antd';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../locale';

interface PermitDocumentRecord {
  id?: string | number;
}

export function usePermitDocumentSyncActionProps(): {
  loading: boolean;
  disabled: boolean;
  onClick: () => Promise<void>;
} {
  const api = useAPIClient();
  const record = useRecord() as PermitDocumentRecord;
  const { getDataBlockRequest } = useDataBlockRequestGetter();
  const { message } = App.useApp();
  const { t } = useTranslation(NAMESPACE);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  const handleSync = async (): Promise<void> => {
    if (inFlight.current || record.id === null || record.id === undefined) {
      return;
    }
    inFlight.current = true;
    setLoading(true);
    try {
      await api.request({
        url: `/permit_documents:sync/${encodeURIComponent(String(record.id))}`,
        method: 'post',
      });
      message.success(t('action.checkCompleted'));
    } catch {
      message.error(t('errors.checkFailed'));
    } finally {
      const dataBlockRequest = getDataBlockRequest();
      if (dataBlockRequest) {
        try {
          await dataBlockRequest.refreshAsync();
        } catch {
          message.error(t('errors.refreshFailed'));
        }
      } else {
        message.error(t('errors.refreshFailed'));
      }
      inFlight.current = false;
      setLoading(false);
    }
  };

  return {
    loading,
    disabled: loading || record.id === null || record.id === undefined,
    onClick: handleSync,
  };
}
