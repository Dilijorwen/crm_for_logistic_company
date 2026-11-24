/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useEffect, useState } from 'react';
import { Alert, Button, Pagination, Space } from 'antd';
import { catalogPageSize, getDocumentErrorText } from '../../../entities/process-document';
import type { CatalogItem, CatalogQuery, DocumentsCatalogApi } from '../../../entities/process-document';
import { DocumentsList } from './DocumentsList';
import { blockClass, useDocumentsTheme } from './styles';

export function CatalogRows({
  rows,
  open,
  fileList,
  loading,
  download,
}: {
  rows: CatalogItem[];
  open: (item: CatalogItem) => void;
  fileList?: boolean;
  loading?: boolean;
  download?: (item: CatalogItem) => void;
}) {
  const style = useDocumentsTheme();
  return (
    <div className={blockClass} style={style}>
      <DocumentsList
        compactActions
        files={fileList ? rows : []}
        loading={loading}
        previewFile={open}
        downloadFile={download}
        folderNavigation={
          fileList
            ? undefined
            : {
                folders: rows,
                folderId: null,
                breadcrumbs: [],
                setFolderId: (id) => {
                  const row = rows.find((item) => item.id === id);
                  if (row) open(row);
                },
              }
        }
      />
    </div>
  );
}

export function DocumentsCatalogList({
  api,
  query,
  open,
  fileList = false,
  download,
}: {
  api: DocumentsCatalogApi;
  query: CatalogQuery;
  open: (item: CatalogItem) => void;
  fileList?: boolean;
  download?: (item: CatalogItem) => void;
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
      <CatalogRows rows={result?.rows ?? []} open={open} fileList={fileList} loading={!result} download={download} />
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
