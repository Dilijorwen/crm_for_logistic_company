/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { FolderOpenOutlined, UploadOutlined } from '@ant-design/icons';
import { observer } from '@formily/react';
import { useAPIClient } from '@nocobase/client';
import type { FlowModel, SingleRecordResource } from '@nocobase/flow-engine';
import { Alert, Button, Form, Modal, Spin, Typography, message } from 'antd';
import type { FormInstance } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FORM_DOCUMENT_DRAFT_HEADER,
  FORM_DOCUMENT_DRAFT_PENDING,
  documentRecordId,
  isDocumentFormResource,
  supportsFormFolderUploads,
} from '../../../../contracts/processDocuments';
import type { DocumentIdentifier, DocumentFormResource } from '../../../../contracts/processDocuments';
import { FormDocumentDraftsApi, getDocumentErrorText } from '../../../entities/process-document';
import type { FormDocumentBatch, ProcessDocumentDto, SelectedDocument } from '../../../entities/process-document';
import { readDroppedDocuments } from '../model/droppedDocuments';
import { DocumentsList, EmptyFormDocumentList, FormDocumentListContext } from './DocumentsList';
import {
  DocumentBrowser,
  DocumentUploadMenu,
  openDocumentFolderDialog,
  openDocumentRenameDialog,
} from './DocumentBrowser';

export interface DocumentFormBinding {
  model: FlowModel;
  resource: SingleRecordResource;
}

export interface ShipmentDocumentDraftBinding {
  form: FormInstance;
  companyPath(): (string | number)[];
  setTokens(tokens: string[]): void;
}

const attached = new WeakSet<SingleRecordResource>();
const directoryInput = { webkitdirectory: '' };

const creationFolders = ['Декларанты', 'Менеджеры'] as const;

function FormFolderUploadComponent({
  resource: collection,
  findForm,
  shipmentDraft,
  draftCompany,
  children,
}: {
  resource: DocumentFormResource;
  findForm?: () => DocumentFormBinding | undefined;
  shipmentDraft?: ShipmentDocumentDraftBinding;
  draftCompany?: unknown;
  children?: React.ReactNode;
}) {
  const client = useAPIClient();
  const api = useMemo(() => new FormDocumentDraftsApi(client), [client]);
  const [batches, setBatches] = useState<FormDocumentBatch[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [folder, setFolder] = useState<string | null>(null);
  const [modal, modalHolder] = Modal.useModal();
  const shipmentForm = collection === 'shipments' ? findForm?.() : undefined;
  const isNewShipment = Boolean(shipmentDraft) || shipmentForm?.resource.isNewRecord === true;
  const shipmentId = isNewShipment
    ? null
    : documentRecordId(shipmentForm?.resource.getMeta('currentFilterByTk') ?? shipmentForm?.resource.getFilterByTk());
  const companyId = shipmentDraft
    ? documentRecordId(
        draftCompany && typeof draftCompany === 'object' && 'id' in draftCompany ? draftCompany.id : draftCompany,
      )
    : isNewShipment
      ? formCompanyId(shipmentForm)
      : undefined;
  const runForm = collection === 'transport_runs' ? findForm?.() : undefined;
  const runId = runForm?.resource.isNewRecord
    ? null
    : documentRecordId(runForm?.resource.getMeta('currentFilterByTk') ?? runForm?.resource.getFilterByTk());
  const isCreatingDocuments = Boolean(shipmentDraft) || (collection === 'transport_runs' && runId === null);
  const accessId = collection === 'transport_runs' ? runId : shipmentId;
  const accessKey = accessId !== undefined ? JSON.stringify([collection, accessId, companyId]) : undefined;
  const [access, setAccess] = useState<{ key: string; canRead?: boolean; canWrite?: boolean; error?: string }>();
  const currentAccess = access?.key === accessKey ? access : undefined;
  const canStage =
    Boolean(findForm || shipmentDraft) &&
    ((collection !== 'shipments' && collection !== 'transport_runs') || currentAccess?.canWrite === true);
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

  useEffect(() => {
    if (accessId === undefined || !accessKey || (collection !== 'shipments' && collection !== 'transport_runs')) return;
    let active = true;
    api
      .folderPermissions(collection, accessId, companyId)
      .then((permissions) => {
        if (active) setAccess({ key: accessKey, ...permissions });
      })
      .catch((reason) => {
        if (active) setAccess({ key: accessKey, error: getDocumentErrorText(reason, 'Не удалось проверить доступ.') });
      });
    return () => {
      active = false;
    };
  }, [accessId, accessKey, api, collection, companyId]);

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
      shipmentDraft?.setTokens([]);
      api.discard(current.batches.map(({ token }) => token)).catch(reportCleanupError);
      current.batches = [];
    };
  }, [api, shipmentDraft]);

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

  async function stage(
    select: () => Promise<{ files: SelectedDocument[]; emptyFolders?: string[] }>,
    folderId?: DocumentIdentifier | null,
    targetPath = folder,
  ) {
    const current = session.current;
    if (current.busy || !canStage || (shipmentDraft && targetPath === null)) return;
    const generation = current.generation;
    current.busy = true;
    setBusy(true);
    setError(undefined);
    try {
      const form = findForm?.();
      if (!shipmentDraft && !form)
        throw new Error('Блок загрузки должен находиться рядом с одной штатной формой добавления или изменения.');
      const recordId = documentRecordId(form?.resource.getMeta('currentFilterByTk') ?? form?.resource.getFilterByTk());
      const resource = shipmentDraft ? 'shipments' : form?.resource.getResourceName();
      if (
        !isDocumentFormResource(resource) ||
        resource !== collection ||
        (form && !form.resource.isNewRecord && !recordId)
      ) {
        throw new Error('Не удалось определить сохраняемую запись.');
      }
      if (form) {
        bind(form);
        updateHeader(form, true);
      }
      shipmentDraft?.setTokens([FORM_DOCUMENT_DRAFT_PENDING]);
      const { files, emptyFolders } = await select();
      const prefix = isCreatingDocuments && targetPath ? `${targetPath}/` : '';
      const folders = supportsFormFolderUploads(resource) ? emptyFolders?.map((name) => prefix + name) : undefined;
      if (!current.mounted || current.generation !== generation) return;
      if (!files.length && !folders?.length) throw new Error('В выбранной папке нет файлов.');
      const batch = await api.stage(
        {
          resource,
          recordId: form?.resource.isNewRecord ? null : recordId ?? null,
        },
        prefix ? files.map((item) => ({ ...item, name: prefix + item.name })) : files,
        folderId,
        folders,
        companyId,
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
        shipmentDraft?.setTokens(current.batches.map(({ token }) => token));
        setBusy(false);
      }
    }
  }

  async function updateDraft(change: (batches: FormDocumentBatch[]) => Promise<FormDocumentBatch[]>) {
    const current = session.current;
    if (current.busy) throw new Error('Временные файлы уже изменяются.');
    const generation = current.generation;
    current.busy = true;
    if (current.binding) updateHeader(current.binding, true);
    shipmentDraft?.setTokens([FORM_DOCUMENT_DRAFT_PENDING]);
    setBusy(true);
    try {
      const next = await change(current.batches);
      if (!current.mounted || current.generation !== generation) return;
      current.batches = next;
      setBatches(next);
      setError(undefined);
    } finally {
      current.busy = false;
      if (current.mounted) {
        if (current.binding) updateHeader(current.binding);
        shipmentDraft?.setTokens(current.batches.map(({ token }) => token));
        setBusy(false);
      }
    }
  }

  async function clearDraft() {
    try {
      await updateDraft(async (current) => {
        await api.discard(current.map(({ token }) => token));
        return [];
      });
    } catch (reason) {
      setError(getDocumentErrorText(reason, 'Не удалось удалить временные файлы.'));
    }
  }

  async function editDraftFile(file: ProcessDocumentDto, title: string | null) {
    try {
      await updateDraft(async (current) => {
        const batch = current.find(({ files }) => files.some(({ id }) => id === file.id));
        if (!batch) return current;
        const next = await api.editFile(batch.token, String(file.id), title);
        return current.flatMap((item) => (item === batch ? (next ? [next] : []) : [item]));
      });
    } catch (reason) {
      message.error(
        getDocumentErrorText(reason, title === null ? 'Не удалось удалить файл.' : 'Не удалось сохранить имя.'),
      );
      throw reason;
    }
  }

  function renameDraftFile(file: ProcessDocumentDto) {
    openDocumentRenameDialog(modal, 'file', file.title, file.original_filename, (name) => editDraftFile(file, name));
  }

  function deleteDraftFile(file: ProcessDocumentDto) {
    modal.confirm({
      title: `Удалить файл «${file.title}»?`,
      content: 'Файл будет удалён из черновика и не попадёт в хранилище.',
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: () => editDraftFile(file, null),
    });
  }
  const draftActions = {
    renameFile: busy ? undefined : renameDraftFile,
    deleteFile: busy ? undefined : deleteDraftFile,
  };

  function onFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files ?? [], (file) => ({
      file,
      name: file.webkitRelativePath || file.name,
    }));
    event.currentTarget.value = '';
    if (selected.length) return stage(async () => ({ files: selected }));
  }

  const canShowUpload = canStage && (!shipmentDraft || folder !== null);
  const clearDraftButton = batches.length > 0 && (
    <Button disabled={busy} onClick={clearDraft}>
      Очистить черновик
    </Button>
  );

  if (accessKey) {
    if (!currentAccess) return <Spin aria-label="Проверка прав на документы" />;
    if (currentAccess.error) return <Alert type="error" showIcon message={currentAccess.error} />;
    if (!currentAccess.canRead) return clearDraftButton || null;
  }

  if (isCreatingDocuments) {
    const prefix = folder ? `${folder}/` : '';
    const breadcrumbs =
      folder?.split('/').map((title, index, parts) => ({
        id: parts.slice(0, index + 1).join('/'),
        title,
      })) ?? [];
    const folderNames = new Set<string>(shipmentDraft && folder === null ? creationFolders : []);
    const files = batches.flatMap((batch) => {
      for (const path of batch.emptyFolders ?? []) {
        if (path.startsWith(prefix) && path.length > prefix.length)
          folderNames.add(path.slice(prefix.length).split('/')[0]);
      }
      return batch.files.flatMap((file) => {
        if (!file.name.startsWith(prefix)) return [];
        const name = file.name.slice(prefix.length);
        const slash = name.indexOf('/');
        if (slash !== -1) {
          folderNames.add(name.slice(0, slash));
          return [];
        }
        return [draftFileRow(file, name)];
      });
    });
    const createFolder = () =>
      openDocumentFolderDialog(modal, (name) => stage(async () => ({ files: [], emptyFolders: [name] })));
    return (
      <DocumentBrowser title={shipmentDraft ? 'Документы поставки' : 'Документы рейса'}>
        {modalHolder}
        {error && <Alert type="error" showIcon message={error} />}
        {!canStage && <Alert type="info" showIcon message="У вас нет права загружать документы в разделе ВЭД." />}
        {canShowUpload && (
          <div className="process-documents-toolbar">
            <DocumentUploadMenu
              busy={busy}
              fileInput={fileInput}
              folderInput={folderInput}
              createFolder={createFolder}
            />
            {clearDraftButton}
            <input type="file" hidden ref={fileInput} multiple onChange={onFileSelection} />
            <input type="file" hidden ref={folderInput} {...directoryInput} multiple onChange={onFileSelection} />
          </div>
        )}
        {folder && (
          <div className="process-documents-breadcrumbs">
            <Button type="link" className="process-documents-crumb" onClick={() => setFolder(null)}>
              К списку файлов
            </Button>
            {breadcrumbs.map(({ id, title }) => (
              <React.Fragment key={id}>
                <span>/</span>
                {id === folder ? (
                  <Typography.Text strong>{title}</Typography.Text>
                ) : (
                  <Button type="link" className="process-documents-crumb" onClick={() => setFolder(id)}>
                    {title}
                  </Button>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
        <DocumentsList
          files={files}
          {...draftActions}
          folderNavigation={{
            folders: [...folderNames].map((title) => ({ id: prefix + title, title })),
            folderId: folder,
            breadcrumbs,
            setFolderId: (id) => setFolder(id === null ? null : String(id)),
          }}
          allowDropAtCurrentFolder={canShowUpload}
          onDrop={
            canStage && !busy
              ? (transfer, destination) =>
                  stage(() => readDroppedDocuments(transfer), undefined, destination ? String(destination.id) : folder)
              : undefined
          }
        />
      </DocumentBrowser>
    );
  }

  const controls = (
    <>
      {modalHolder}
      {error && <Alert type="error" showIcon message={error} />}
      {canShowUpload ? (
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
            {clearDraftButton}
          </div>
          <input type="file" hidden ref={fileInput} multiple onChange={onFileSelection} />
          <input type="file" hidden ref={folderInput} {...directoryInput} onChange={onFileSelection} />
        </>
      ) : canStage ? null : (collection === 'shipments' || collection === 'transport_runs') &&
        currentAccess?.canRead ? (
        <>
          <Alert type="info" showIcon message="У вас нет права загружать документы в разделе ВЭД." />
          {clearDraftButton}
        </>
      ) : (
        <Alert type="info" showIcon message="Добавьте блок загрузки рядом со штатной формой записи." />
      )}
    </>
  );
  return (
    <FormDocumentListContext.Provider
      value={{
        controls,
        files: batches.flatMap(({ files }) => files.map((file) => draftFileRow(file))),
        emptyFolders: batches.flatMap(({ emptyFolders }) => emptyFolders ?? []),
        ...draftActions,
        onDrop:
          canStage && !busy ? (transfer, folderId) => stage(() => readDroppedDocuments(transfer), folderId) : undefined,
      }}
    >
      <React.Fragment key={revision}>{children ?? <EmptyFormDocumentList />}</React.Fragment>
    </FormDocumentListContext.Provider>
  );
}

function draftFileRow(file: FormDocumentBatch['files'][number], name = file.name): ProcessDocumentDto {
  return { id: file.id, title: name, file_size: file.size, original_filename: file.name.split('/').at(-1) };
}

export const FormFolderUpload = observer(FormFolderUploadComponent);

export function WorkspaceShipmentDraftUpload({ binding }: { binding: ShipmentDocumentDraftBinding }) {
  const company: unknown = Form.useWatch(
    (values) => binding.companyPath().reduce((current, key) => current?.[key], values),
    { form: binding.form, preserve: true },
  );
  return <FormFolderUpload resource="shipments" shipmentDraft={binding} draftCompany={company} />;
}

function formCompanyId(binding: DocumentFormBinding | undefined): string | undefined {
  const values = binding?.model.context?.formValues as { company?: unknown; company_id?: unknown } | undefined;
  if (!values) return;
  const company = values.company;
  if (company === undefined) return documentRecordId(values.company_id);
  return documentRecordId(company && typeof company === 'object' && 'id' in company ? company.id : company);
}

function reportCleanupError() {
  console.warn('[process-documents] Временные файлы будут удалены автоочисткой.');
}
