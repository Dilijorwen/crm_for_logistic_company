/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { LoadingOutlined } from '@ant-design/icons';
import { observer } from '@formily/react';
import { Alert, Spin } from 'antd';
import type { Collection } from '@nocobase/flow-engine';
import React, { useEffect, useMemo, useState } from 'react';
import { ensureProcessDocumentsDraftToken } from '../../../entities/process-document';
import type { DocumentRequestScope } from '../../../entities/process-document';
import { useProcessTarget, isEmptyResourceKey } from '../model/useProcessTarget';
import type { ProcessDocumentsModelContext, ProcessTarget } from '../model/useProcessTarget';
import { documentBlockTarget } from '../model/documentBlockTarget';
import { ScopedDocuments } from './ScopedDocuments';
import { RunDocuments } from './RunDocuments';
import { RecordAttachments } from './RecordAttachments';

type ProcessResourceKey = string | number;

interface DocumentsBlockProps {
  shipmentId?: ProcessResourceKey | null;
  modelContext?: ProcessDocumentsModelContext;
  dataSourceKey?: string;
  getCollection?: (name: string, dataSourceKey: string) => Collection | undefined;
  canUpdateField?: (collection: string, field: string, dataSourceKey: string) => Promise<boolean>;
}

function ShipmentDocuments({ shipmentId, modelContext }: Pick<DocumentsBlockProps, 'shipmentId' | 'modelContext'>) {
  const processTarget: ProcessTarget = useProcessTarget(modelContext, shipmentId);
  const processKey = processTarget.status === 'ready' ? processTarget.key : undefined;
  const [draftToken, setDraftToken] = useState<string>();
  useEffect(() => {
    if (processTarget.status === 'new') {
      setDraftToken(ensureProcessDocumentsDraftToken());
      return;
    }
    setDraftToken(undefined);
  }, [processTarget.status]);

  const requestScope = useMemo<DocumentRequestScope | null>(() => {
    if (!isEmptyResourceKey(processKey)) {
      return { shipmentId: processKey };
    }
    if (processTarget.status === 'new' && draftToken) {
      return { draftToken };
    }
    return null;
  }, [draftToken, processKey, processTarget.status]);

  if (processTarget.status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
        <Spin indicator={<LoadingOutlined spin />} />
      </div>
    );
  }

  if (processTarget.status !== 'ready' && processTarget.status !== 'new') {
    return <Alert type="info" showIcon message="Сначала сохраните поставку, чтобы открыть документы." />;
  }

  return <ScopedDocuments requestScope={requestScope} hasPendingDraft={processTarget.status === 'new'} />;
}

function ProcessDocumentsBlockComponent(props: DocumentsBlockProps) {
  const dataSourceKey = props.dataSourceKey ?? 'main';
  const target = documentBlockTarget(
    props.modelContext,
    props.shipmentId,
    (name) => props.getCollection?.(name, dataSourceKey),
  );
  if (dataSourceKey !== 'main') {
    return <Alert type="info" showIcon message="Блок документов доступен для основного источника данных." />;
  }
  switch (target.kind) {
    case 'shipment':
      return <ShipmentDocuments shipmentId={props.shipmentId} modelContext={props.modelContext} />;
    case 'run':
      return <RunDocuments key={target.recordId} runId={target.recordId} />;
    case 'company':
    case 'attachment': {
      const collection = props.getCollection?.(target.collection, dataSourceKey);
      const fields =
        collection
          ?.getFields()
          .filter((field) => field.interface === 'attachment' && field.target === 'attachments')
          .map((field) => ({
            name: String(field.name),
            title: String(field.title),
            multiple: ['hasMany', 'belongsToMany', 'belongsToArray'].includes(field.type),
            readOnly: Boolean(field.readonly),
          })) ?? [];
      const attachments = (
        <RecordAttachments
          key={JSON.stringify([dataSourceKey, target.collection, target.recordId])}
          recordId={target.recordId}
          collection={target.collection}
          dataSourceKey={dataSourceKey}
          fields={fields}
          canUpdateField={props.canUpdateField}
        />
      );
      if (target.kind === 'attachment') return attachments;
      return (
        <CompanyDocuments companyId={target.recordId}>
          {fields.length > 0 && (
            <details>
              <summary>Вложения карточки</summary>
              {attachments}
            </details>
          )}
        </CompanyDocuments>
      );
    }
    case 'unsaved':
      return <Alert type="info" showIcon message="Сохраните запись, чтобы загрузить документы." />;
  }
}

function CompanyDocuments({ companyId, children }: { companyId: ProcessResourceKey; children: React.ReactNode }) {
  const scope = useMemo(() => ({ companyId }), [companyId]);
  return (
    <ScopedDocuments title="Учредительные документы" requestScope={scope}>
      {children}
    </ScopedDocuments>
  );
}

export const ProcessDocumentsBlock = observer(ProcessDocumentsBlockComponent);
