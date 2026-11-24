/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useAPIClient } from '@nocobase/client';
import { Alert, Spin } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import {
  companyRequestFolderTypes,
  companyRequestFolderTitle,
  documentRecordId,
  isCompanyRequestFolder,
} from '../../../../contracts/processDocuments';
import type { DocumentIdentifier } from '../../../../contracts/processDocuments';
import { ProcessDocumentsApi, getDocumentErrorText, isDocumentAccessDenied } from '../../../entities/process-document';
import { ScopedDocuments } from './ScopedDocuments';
import { EmptyFormDocumentList } from './DocumentsList';

const unavailable = 'Папка «По запросу» отсутствует или недоступна.';

export function CompanyRequestDocuments({ recordId, readOnly }: { recordId: DocumentIdentifier; readOnly: boolean }) {
  const client = useAPIClient();
  const key = String(recordId);
  const [result, setResult] = useState<{
    key: string;
    companyId?: string;
    folderId?: DocumentIdentifier;
    message?: string;
  }>();
  useEffect(() => {
    let active = true;
    const finish = (value: Omit<NonNullable<typeof result>, 'key'>) => {
      if (active) setResult({ ...value, key });
    };
    async function load() {
      try {
        const companyId = documentRecordId(recordId);
        if (!companyId) return finish({ message: unavailable });
        const api = new ProcessDocumentsApi(client);
        const scope = { companyId, companyArea: 'company' as const };
        const root = await api.list(scope, null);
        const matches = root.folders.filter(({ title }) => isCompanyRequestFolder(title));
        if (matches.length > 1) return finish({ message: 'У компании найдено несколько папок «По запросу».' });
        if (!matches.length)
          return finish({
            message: root.emptyRequestFolders?.includes(companyRequestFolderTitle)
              ? 'Документов пока нет'
              : unavailable,
          });
        const requestFolder = await api.list(scope, matches[0].id);
        const type = companyRequestFolderTypes.our_companies;
        const matchingTypes =
          String(requestFolder.currentFolder?.id) === String(matches[0].id)
            ? requestFolder.folders.filter(({ title }) => title === type)
            : [];
        if (matchingTypes.length !== 1) {
          return finish({
            message: matchingTypes.length
              ? `У компании найдено несколько папок «${type}».`
              : requestFolder.emptyRequestFolders?.includes(type)
                ? 'Документов пока нет'
                : `Папка «По запросу / ${type}» отсутствует или недоступна.`,
          });
        }
        finish({ companyId, folderId: matchingTypes[0].id });
      } catch (error) {
        finish({ message: isDocumentAccessDenied(error) ? unavailable : getDocumentErrorText(error, unavailable) });
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [client, key, recordId]);
  const companyId = result?.companyId;
  const scope = useMemo(() => (companyId ? { companyId, companyArea: 'company' as const } : null), [companyId]);
  if (result?.key !== key) return <Spin aria-label="Загрузка документов" />;
  if (!scope || result.folderId == null)
    return (
      <>
        <Alert type="info" showIcon message={result.message ?? unavailable} />
        {!readOnly && <EmptyFormDocumentList />}
      </>
    );
  return (
    <ScopedDocuments
      requestScope={scope}
      rootFolderId={result.folderId}
      title={companyRequestFolderTypes.our_companies}
      titleAsHeading
      readOnly={readOnly}
      allowUpload={false}
      showRefresh={false}
      fixedFolderMessage
    />
  );
}
