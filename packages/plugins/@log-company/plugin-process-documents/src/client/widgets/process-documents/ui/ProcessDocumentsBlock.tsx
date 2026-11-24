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
import { isDocumentFormResource } from '../../../../contracts/processDocuments';
import { useProcessTarget, isEmptyResourceKey } from '../model/useProcessTarget';
import type { ProcessDocumentsModelContext, ProcessTarget } from '../model/useProcessTarget';
import { documentBlockTarget } from '../model/documentBlockTarget';
import { ScopedDocuments } from './ScopedDocuments';
import { RunDocuments } from './RunDocuments';
import { RecordAttachments } from './RecordAttachments';
import { FormFolderUpload, type DocumentFormBinding } from './FormFolderUpload';
import { CompanyRequestDocuments } from './CompanyRequestDocuments';

type ProcessResourceKey = string | number;

const shipmentHeading = { title: 'Документы поставки', titleAsHeading: true };

interface DocumentsBlockProps {
  folderMode?: 'view' | 'upload';
  findForm?: () => DocumentFormBinding | undefined;
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

  return (
    <ScopedDocuments
      {...shipmentHeading}
      requestScope={requestScope}
      hasPendingDraft={processTarget.status === 'new'}
      showRefresh={false}
    />
  );
}

function ProcessDocumentsBlockComponent(props: DocumentsBlockProps) {
  const dataSourceKey = props.dataSourceKey ?? 'main';
  const shipmentScope = useMemo(
    () => (props.shipmentId == null ? null : { shipmentId: props.shipmentId }),
    [props.shipmentId],
  );
  if (dataSourceKey !== 'main') {
    return <Alert type="info" showIcon message="Блок документов доступен для основного источника данных." />;
  }
  if (shipmentScope) {
    return (
      <ScopedDocuments
        {...shipmentHeading}
        requestScope={shipmentScope}
        readOnly={props.folderMode === 'view'}
        showRefresh={false}
      />
    );
  }
  const target = documentBlockTarget(
    props.modelContext,
    props.shipmentId,
    (name) => props.getCollection?.(name, dataSourceKey),
  );
  // Keep the existing behavior for shipment blocks without an explicit mode.
  if (!props.folderMode && target.kind === 'shipment') {
    return <ShipmentDocuments shipmentId={props.shipmentId} modelContext={props.modelContext} />;
  }
  const readOnly = props.folderMode !== 'upload';
  const recordId = target.kind === 'unsaved' ? undefined : target.recordId;
  const content =
    recordId === undefined ? (
      readOnly ? (
        <Alert type="info" showIcon message="Документы появятся здесь после сохранения записи." />
      ) : null
    ) : target.kind === 'shipment' ? (
      <ScopedDocuments
        {...shipmentHeading}
        requestScope={{ shipmentId: recordId }}
        readOnly={readOnly}
        allowUpload={false}
        showRefresh={false}
      />
    ) : target.kind === 'run' ? (
      <RunDocuments runId={recordId} readOnly={readOnly} allowUpload={false} showRefresh={false} />
    ) : target.kind === 'company' ? (
      <CompanyRequestDocuments recordId={recordId} readOnly={readOnly} />
    ) : (
      <RecordAttachments
        key={JSON.stringify([dataSourceKey, target.collection, recordId])}
        recordId={recordId}
        collection={target.collection}
        dataSourceKey={dataSourceKey}
        fields={attachmentFields(target.collection)}
        canUpdateField={props.canUpdateField}
        readOnly={readOnly}
      />
    );
  if (readOnly) return content;
  if (!isDocumentFormResource(target.collection)) {
    return <Alert type="info" showIcon message="Отложенная загрузка для этой формы не настроена." />;
  }
  return (
    <FormFolderUpload
      key={JSON.stringify([target.collection, recordId ?? null])}
      resource={target.collection}
      findForm={props.findForm}
    >
      {content}
    </FormFolderUpload>
  );

  function attachmentFields(name: string) {
    const collection = props.getCollection?.(name, dataSourceKey);
    const fields =
      collection
        ?.getFields()
        .filter(
          (field) =>
            field.interface === 'attachment' &&
            field.target === 'attachments' &&
            (name !== 'permit_documents' || field.name === 'documents'),
        )
        .map((field) => ({
          name: String(field.name),
          title: String(field.title),
          multiple: ['hasMany', 'belongsToMany', 'belongsToArray'].includes(field.type),
          readOnly: Boolean(field.readonly),
        })) ?? [];
    return fields;
  }
}

export const ProcessDocumentsBlock = observer(ProcessDocumentsBlockComponent);
