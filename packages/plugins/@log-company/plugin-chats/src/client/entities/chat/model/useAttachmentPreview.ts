/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useAPIClient } from '@nocobase/client';
import { useEffect, useRef, useState } from 'react';
import { loadChatAttachment } from '../api/attachmentsApi';

export function useAttachmentPreview(attachmentId: string, automatic: boolean) {
  const api = useAPIClient();
  const [requested, setRequested] = useState(automatic);
  const [attempt, setAttempt] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [attachmentId]);

  useEffect(() => {
    if (!requested || !visible) return;
    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(false);
    setUrl(null);
    const load = async (): Promise<void> => {
      try {
        const blob = await loadChatAttachment(api, attachmentId, true);
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, attachmentId, requested, visible, attempt]);

  return {
    url,
    loading,
    error,
    containerRef,
    request: () => {
      setRequested(true);
      setAttempt((value) => value + 1);
    },
  };
}
