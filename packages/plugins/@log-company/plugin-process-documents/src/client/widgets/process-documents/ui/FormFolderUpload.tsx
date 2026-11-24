/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { FolderOpenOutlined, UploadOutlined } from '@ant-design/icons';
import { useAPIClient } from '@nocobase/client';
import type { FlowModel, SingleRecordResource } from '@nocobase/flow-engine';
import { Alert, Button } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FORM_DOCUMENT_DRAFT_HEADER,
  FORM_DOCUMENT_DRAFT_PENDING,
  documentRecordId,
  isDocumentFormResource,
  type DocumentFormResource,
} from '../../../../contracts/processDocuments';
import { FormDocumentDraftsApi, getDocumentErrorText } from '../../../entities/process-document';
import type { FormDocumentBatch, SelectedDocument } from '../../../entities/process-document';
import { droppedDocuments } from '../model/droppedDocuments';
import { EmptyFormDocumentList, FormDocumentListContext } from './DocumentsList';

export interface DocumentFormBinding {
  model: FlowModel;
  resource: SingleRecordResource;
}

const attached = new WeakSet<SingleRecordResource>();
const directoryInput = { webkitdirectory: '' };

export function FormFolderUpload({
  resource: collection,
  findForm,
  children,
}: {
  resource: DocumentFormResource;
  findForm?: () => DocumentFormBinding | undefined;
  children: React.ReactNode;
}) {
  const client = useAPIClient();
  const api = useMemo(() => new FormDocumentDraftsApi(client), [client]);
  const [batches, setBatches] = useState<FormDocumentBatch[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const canStage = Boolean(findForm);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const session = useRef<{
    batches: FormDocumentBatch[];
    binding?: DocumentFormBinding;
    mounted: boolean;
    busy: boolean;
    generation: number;
  }>({
    batches: [],
    mounted: false,
    busy: false,
    generation: 0,
  });

  function updateHeader(binding: DocumentFormBinding, pending = false) {
    const values = session.current.batches.map(({ token }) => token).join(',');
    if (pending || values)
      binding.resource.addRequestHeader(FORM_DOCUMENT_DRAFT_HEADER, pending ? FORM_DOCUMENT_DRAFT_PENDING : values);
    else binding.resource.removeRequestHeader(FORM_DOCUMENT_DRAFT_HEADER);
  }

  useEffect(() => {
    const current = session.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
      current.generation += 1;
      unbind.current?.();
      api.discard(current.batches.map(({ token }) => token)).catch(reportCleanupError);
      current.batches = [];
    };
  }, [api]);

  const unbind = useRef<() => void>();

  function bind(form: DocumentFormBinding) {
    const current = session.current;
    if (current.binding?.resource === form.resource) return;
    if (current.binding || attached.has(form.resource)) {
      throw new Error('Для сохранения файлов используйте один блок загрузки на форму.');
    }
    const reset = () => {
      current.generation += 1;
      const tokens = current.batches.map(({ token }) => token);
      current.batches = [];
      updateHeader(form);
      setBatches([]);
      api.discard(tokens).catch(reportCleanupError);
    };
    const saved = () => {
      current.batches = [];
      updateHeader(form);
      setBatches([]);
      setRevision((value) => value + 1);
    };
    attached.add(form.resource);
    current.binding = form;
    form.resource.on('saved', saved);
    form.model.emitter.on('onFieldReset', reset);
    unbind.current = () => {
      form.resource.off('saved', saved);
      form.model.emitter.off('onFieldReset', reset);
      form.resource.removeRequestHeader(FORM_DOCUMENT_DRAFT_HEADER);
      attached.delete(form.resource);
      current.binding = undefined;
    };
  }

  async function stage(select: () => Promise<SelectedDocument[]>) {
    const current = session.current;
    if (current.busy || !canStage) return;
    const generation = current.generation;
    current.busy = true;
    setBusy(true);
    setError(undefined);
    try {
      const form = findForm?.();
      if (!form)
        throw new Error('Блок загрузки должен находиться рядом с одной штатной формой добавления или изменения.');
      const recordId = documentRecordId(form.resource.getMeta('currentFilterByTk') ?? form.resource.getFilterByTk());
      const resource = form.resource.getResourceName();
      if (!isDocumentFormResource(resource) || resource !== collection || (!form.resource.isNewRecord && !recordId)) {
        throw new Error('Не удалось определить сохраняемую запись.');
      }
      bind(form);
      updateHeader(form, true);
      const files = await select();
      if (!current.mounted || current.generation !== generation) return;
      if (!files.length) throw new Error('В выбранной папке нет файлов.');
      const batch = await api.stage(
        {
          resource,
          recordId: form.resource.isNewRecord ? null : recordId ?? null,
        },
        files,
      );
      if (!current.mounted || current.generation !== generation) {
        await api.discard([batch.token]);
        return;
      }
      current.batches = [...current.batches, batch];
      setBatches(current.batches);
    } catch (error) {
      if (current.mounted) setError(getDocumentErrorText(error, 'Не удалось добавить файлы.'));
      else reportCleanupError();
    } finally {
      current.busy = false;
      if (current.mounted) {
        if (current.binding) updateHeader(current.binding);
        setBusy(false);
      }
    }
  }

  async function clearDraft() {
    if (session.current.busy) return;
    const current = session.current;
    current.busy = true;
    if (current.binding) updateHeader(current.binding, true);
    setBusy(true);
    try {
      await api.discard(current.batches.map(({ token }) => token));
      current.batches = [];
      setBatches([]);
      setError(undefined);
    } catch (error) {
      setError(getDocumentErrorText(error, 'Не удалось удалить временные файлы.'));
    } finally {
      current.busy = false;
      if (current.binding) updateHeader(current.binding);
      setBusy(false);
    }
  }

  function onFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files ?? [], (file) => ({
      file,
      name: file.webkitRelativePath || file.name,
    }));
    event.currentTarget.value = '';
    if (selected.length) return stage(async () => selected);
  }

  const controls = (
    <>
      {error && <Alert type="error" showIcon message={error} />}
      {canStage ? (
        <>
          <div className="process-documents-toolbar">
            <Button
              loading={busy}
              icon={<UploadOutlined aria-hidden="true" />}
              onClick={() => fileInput.current?.click()}
            >
              Файлы
            </Button>
            <Button
              disabled={busy}
              icon={<FolderOpenOutlined aria-hidden="true" />}
              onClick={() => folderInput.current?.click()}
            >
              Папка
            </Button>
            {batches.length > 0 && (
              <Button disabled={busy} onClick={clearDraft}>
                Очистить черновик
              </Button>
            )}
          </div>
          <input type="file" hidden ref={fileInput} multiple onChange={onFileSelection} />
          <input type="file" hidden ref={folderInput} {...directoryInput} onChange={onFileSelection} />
        </>
      ) : (
        <Alert type="info" showIcon message="Добавьте блок загрузки рядом со штатной формой записи." />
      )}
      {batches.length > 0 && (
        <div>
          <div className="process-documents-form-hint">Ожидают сохранения</div>
          <ul className="process-documents-draft-files" aria-label="Файлы, ожидающие сохранения">
            {batches.map((batch) =>
              batch.files.map((file, index) => <li key={`${batch.token}:${index}`}>{file.name}</li>),
            )}
          </ul>
        </div>
      )}
    </>
  );
  return (
    <FormDocumentListContext.Provider
      value={{
        controls,
        hasDraftFiles: batches.length > 0,
        onDrop: canStage ? (transfer) => stage(() => droppedDocuments(transfer)) : undefined,
      }}
    >
      <React.Fragment key={revision}>{children ?? <EmptyFormDocumentList />}</React.Fragment>
    </FormDocumentListContext.Provider>
  );
}

function reportCleanupError() {
  console.warn('[process-documents] Временные файлы будут удалены автоочисткой.');
}
