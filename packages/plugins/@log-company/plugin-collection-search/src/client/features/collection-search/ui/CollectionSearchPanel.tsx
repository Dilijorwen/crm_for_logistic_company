/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DatabaseOutlined, SearchOutlined } from '@ant-design/icons';
import { useCompile } from '@nocobase/client';
import { Alert, Button, Empty, Input, List, Spin, Tabs, Tag, Typography, theme } from 'antd';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../../locale';
import type { CollectionSearchMatch, CollectionSearchRow } from '../api/collectionSearchService';
import { useCollectionSearch } from '../hooks/useCollectionSearch';
import { resolveCurrentCollection } from '../model/collectionContext';

interface CollectionSearchPanelProps {
  collection: unknown;
  model?: unknown;
}

function highlight(value: string, term: string, backgroundColor: string): React.ReactNode {
  const normalizedTerm = term.trim();
  if (!normalizedTerm) {
    return value;
  }
  const lowerValue = value.toLocaleLowerCase();
  const lowerTerm = normalizedTerm.toLocaleLowerCase();
  const fragments: React.ReactNode[] = [];
  let cursor = 0;
  let matchIndex = lowerValue.indexOf(lowerTerm);
  while (matchIndex >= 0) {
    fragments.push(value.slice(cursor, matchIndex));
    fragments.push(
      <mark key={`${matchIndex}-${cursor}`} style={{ backgroundColor, padding: 0 }}>
        {value.slice(matchIndex, matchIndex + normalizedTerm.length)}
      </mark>,
    );
    cursor = matchIndex + normalizedTerm.length;
    matchIndex = lowerValue.indexOf(lowerTerm, cursor);
  }
  fragments.push(value.slice(cursor));
  return fragments;
}

function displayValue(match: CollectionSearchMatch, t: (key: string) => string): string {
  if (typeof match.rawValue === 'boolean') {
    return t(match.rawValue ? 'value.yes' : 'value.no');
  }
  return match.value;
}

export function CollectionSearchPanel({ collection: collectionValue, model }: CollectionSearchPanelProps) {
  const { t } = useTranslation(NAMESPACE);
  const compile = useCompile();
  const { token } = theme.useToken();
  const collection = useMemo(() => resolveCurrentCollection(collectionValue, model), [collectionValue, model]);
  const { term, setTerm, rows, status, hasNext, loadMore, minimumLength } = useCollectionSearch(collection);
  const [activeField, setActiveField] = useState('all');
  const fieldCounts = useMemo(() => {
    const counts = new Map<string, { title: string; count: number }>();
    for (const row of rows) {
      for (const match of row.matches) {
        const current = counts.get(match.fieldName);
        counts.set(match.fieldName, {
          title: match.fieldTitle,
          count: (current?.count || 0) + 1,
        });
      }
    }
    return counts;
  }, [rows]);
  const visibleRows = useMemo(
    () =>
      activeField === 'all'
        ? rows
        : rows
            .map((row) => ({
              ...row,
              matches: row.matches.filter((match) => match.fieldName === activeField),
            }))
            .filter((row) => row.matches.length),
    [activeField, rows],
  );
  const tabs = [
    {
      key: 'all',
      label: `${t('results.all')} ${rows.length}`,
    },
    ...Array.from(fieldCounts.entries()).map(([fieldName, item]) => ({
      key: fieldName,
      label: `${String(compile(item.title) ?? item.title)} ${item.count}`,
    })),
  ];

  return (
    <section aria-label={t('block.title')}>
      <Input
        allowClear
        autoFocus
        prefix={<SearchOutlined aria-hidden />}
        placeholder={t('input.placeholder')}
        aria-label={t('input.ariaLabel')}
        value={term}
        onChange={(event) => {
          setActiveField('all');
          setTerm(event.target.value);
        }}
      />

      {rows.length > 0 ? (
        <Tabs activeKey={activeField} items={tabs} onChange={setActiveField} style={{ marginTop: token.marginSM }} />
      ) : null}

      {status === 'error' ? (
        <Alert showIcon type="error" message={t('error.generic')} style={{ marginTop: token.margin }} />
      ) : null}

      {status === 'idle' ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('hint.minimum', { count: minimumLength })}
          style={{ marginBlock: token.marginXL }}
        />
      ) : null}

      {status === 'loading' && rows.length === 0 ? (
        <div
          role="status"
          aria-live="polite"
          style={{ display: 'flex', justifyContent: 'center', padding: token.paddingXL }}
        >
          <Spin tip={t('hint.loadingIndex')}>
            <div style={{ minHeight: 48, minWidth: 280 }} />
          </Spin>
        </div>
      ) : null}

      {status === 'success' && rows.length === 0 ? (
        <Empty description={t('hint.empty')} style={{ marginBlock: token.marginXL }} />
      ) : null}

      {visibleRows.length > 0 ? (
        <>
          <Typography.Text type="secondary">{t('results.bestMatch')}</Typography.Text>
          <List
            aria-live="polite"
            dataSource={visibleRows}
            style={{ maxHeight: '60vh', overflowY: 'auto', marginTop: token.marginXS }}
            renderItem={(row: CollectionSearchRow) => (
              <List.Item key={JSON.stringify(row.recordKey)} style={{ alignItems: 'flex-start' }}>
                <List.Item.Meta
                  avatar={<DatabaseOutlined style={{ color: token.colorPrimary, marginTop: token.marginXXS }} />}
                  title={
                    <Typography.Text strong>
                      {row.title || t('results.recordFallback', { key: Object.values(row.recordKey).join(' / ') })}
                    </Typography.Text>
                  }
                  description={
                    <div style={{ display: 'grid', gap: token.marginXXS }}>
                      {row.matches.map((match) => {
                        const value = displayValue(match, t);
                        return (
                          <div key={match.fieldName}>
                            <Tag bordered={false}>{String(compile(match.fieldTitle) ?? match.fieldTitle)}</Tag>
                            <Typography.Text>{highlight(value, term, token.colorWarningBg)}</Typography.Text>
                          </div>
                        );
                      })}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </>
      ) : null}

      {hasNext ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: token.paddingSM }}>
          <Button loading={status === 'loading'} onClick={loadMore}>
            {t('results.loadMore')}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
