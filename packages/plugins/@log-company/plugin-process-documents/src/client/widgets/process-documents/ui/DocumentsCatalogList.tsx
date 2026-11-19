/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useEffect, useState } from 'react';
import { Alert, Button, Empty, List, Pagination, Space } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import { catalogPageSize, getDocumentErrorText } from '../../../entities/process-document';
import type { CatalogItem, CatalogQuery, DocumentsCatalogApi } from '../../../entities/process-document';

export function DocumentsCatalogList({
  api,
  query,
  open,
  fileList = false,
}: {
  api: DocumentsCatalogApi;
  query: CatalogQuery;
  open: (item: CatalogItem) => void;
  fileList?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ rows: CatalogItem[]; total: number }>();
  const [error, setError] = useState<string>();
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    let current = true;
    setResult(undefined);
    setError(undefined);
    api
      .list(JSON.parse(queryKey) as CatalogQuery, page)
      .then((data) => {
        if (current) setResult(data);
      })
      .catch((reason) => {
        if (current) setError(getDocumentErrorText(reason, 'Не удалось открыть папку.'));
      });
    return () => {
      current = false;
    };
  }, [api, queryKey, page, attempt]);

  if (error)
    return (
      <Alert
        showIcon
        type="error"
        message={error}
        action={<Button onClick={() => setAttempt((previous) => previous + 1)}>Повторить</Button>}
      />
    );

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <List
        size="small"
        loading={!result}
        dataSource={result?.rows ?? []}
        rowKey={(item) => item.id}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Папка пуста" /> }}
        renderItem={(item) => (
          <List.Item>
            <Button
              type="text"
              icon={fileList ? undefined : <FolderOutlined />}
              style={{ height: 'auto', whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'left' }}
              onClick={() => open(item)}
            >
              {item.title}
            </Button>
          </List.Item>
        )}
      />
      {result && result.total > catalogPageSize ? (
        <Pagination
          size="small"
          current={page}
          pageSize={catalogPageSize}
          total={result.total}
          showSizeChanger={false}
          onChange={setPage}
        />
      ) : null}
    </Space>
  );
}
