/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useAPIClient } from '@nocobase/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  searchCurrentCollection,
  type CollectionSearchResponse,
  type CollectionSearchRow,
} from '../api/collectionSearchService';
import type { CurrentCollection } from '../model/collectionContext';

const SEARCH_DELAY_MS = 350;
const MIN_SEARCH_TERM_LENGTH = 3;
const PAGE_SIZE = 20;

type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

function errorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return '';
  }
  const response = (error as { response?: { data?: { error?: { message?: unknown }; errors?: unknown[] } } }).response;
  const serverMessage = response?.data?.error?.message;
  if (typeof serverMessage === 'string') {
    return serverMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '';
}

export function useCollectionSearch(collection: CurrentCollection | null) {
  const api = useAPIClient();
  const [term, setTerm] = useState('');
  const [rows, setRows] = useState<CollectionSearchRow[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [error, setError] = useState('');
  const [hasNext, setHasNext] = useState(false);
  const [nextCursor, setNextCursor] = useState<string>();
  const requestSequence = useRef(0);

  const performSearch = useCallback(
    async (searchTerm: string, cursor?: string, append = false) => {
      if (!collection) {
        return;
      }
      const sequence = ++requestSequence.current;
      setStatus('loading');
      setError('');
      try {
        const result: CollectionSearchResponse = await searchCurrentCollection(api, {
          dataSourceKey: collection.dataSourceKey,
          collectionName: collection.name,
          term: searchTerm,
          cursor,
          pageSize: PAGE_SIZE,
        });
        if (sequence !== requestSequence.current) {
          return;
        }
        setRows((currentRows) => (append ? [...currentRows, ...result.rows] : result.rows));
        setNextCursor(result.nextCursor);
        setHasNext(result.hasNext);
        setStatus('success');
      } catch (searchError) {
        if (sequence !== requestSequence.current) {
          return;
        }
        setRows((currentRows) => (append ? currentRows : []));
        setError(errorMessage(searchError));
        setStatus('error');
      }
    },
    [api, collection],
  );

  useEffect(() => {
    const normalizedTerm = term.trim();
    if (normalizedTerm.length < MIN_SEARCH_TERM_LENGTH || !collection) {
      requestSequence.current += 1;
      setRows([]);
      setHasNext(false);
      setNextCursor(undefined);
      setError('');
      setStatus('idle');
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      performSearch(normalizedTerm);
    }, SEARCH_DELAY_MS);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [collection, performSearch, term]);

  const loadMore = useCallback(async () => {
    if (!hasNext || !nextCursor || status === 'loading') {
      return;
    }
    await performSearch(term.trim(), nextCursor, true);
  }, [hasNext, nextCursor, performSearch, status, term]);

  return {
    term,
    setTerm,
    rows,
    status,
    error,
    hasNext,
    loadMore,
    minimumLength: MIN_SEARCH_TERM_LENGTH,
  };
}
