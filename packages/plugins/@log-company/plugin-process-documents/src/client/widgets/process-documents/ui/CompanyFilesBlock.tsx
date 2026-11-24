/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useAPIClient } from '@nocobase/client';
import { Alert, Button, Modal, Space, Spin, Typography, message } from 'antd';
import { FolderOutlined, LockOutlined } from '@ant-design/icons';
import {
  DocumentsCatalogApi,
  ProcessDocumentsApi,
  RecordAttachmentsApi,
  getDocumentErrorText,
} from '../../../entities/process-document';
import type { CatalogFolder, CatalogItem, CatalogQuery } from '../../../entities/process-document';
import type { SectionPermissions } from '../../../../contracts/processDocuments';
import { DocumentSectionAccessDialog } from './DocumentSectionAccessDialog';
import { CatalogRows, DocumentsCatalogList } from './DocumentsCatalogList';
import { RunDocuments } from './RunDocuments';
import { ScopedDocuments } from './ScopedDocuments';
import { CompanyRequestDocuments } from './CompanyRequestDocuments';
import { DocumentPreviewDialog, downloadDocument } from './DocumentPreviewDialog';
import type { DocumentPreviewTarget } from './DocumentPreviewDialog';
import { RecordAttachments } from './RecordAttachments';
import { DocumentCatalogContext } from './DocumentCatalogContext';

export type CatalogNode =
  | { type: 'catalog' }
  | { type: 'company' | 'customs' | 'unassigned' | 'permits'; company: CatalogItem }
  | { type: 'contracts'; company: CatalogItem }
  | { type: 'contractStatus'; company: CatalogItem; active: boolean }
  | { type: 'contract' | 'agreements'; company: CatalogItem; contract: CatalogItem }
  | { type: 'corporate'; company: CatalogItem; folderId?: CatalogItem['id']; companyArea?: 'company' }
  | { type: 'run'; run: CatalogItem; company?: CatalogItem }
  | { type: 'runGroup' | 'permitGroup'; company: CatalogItem; folder: CatalogFolder }
  | { type: 'shipment'; shipment: CatalogItem }
  | { type: 'permit'; permit: CatalogItem };

function title(node: CatalogNode): string {
  switch (node.type) {
    case 'catalog':
      return 'Компании';
    case 'company':
      return node.company.title;
    case 'customs':
      return 'ВЭД';
    case 'corporate':
      return node.companyArea ? node.company.title : 'Учредительные документы';
    case 'unassigned':
      return 'Поставки без рейса';
    case 'permits':
      return 'Разрешительные документы';
    case 'contracts':
      return 'Контракты';
    case 'contractStatus':
      return node.active ? 'Действующий' : 'Недействующий';
    case 'contract':
      return node.contract.title;
    case 'agreements':
      return 'Доп. соглашение';
    case 'run':
      return node.run.title;
    case 'runGroup':
    case 'permitGroup':
      return node.folder.title;
    case 'shipment':
      return node.shipment.title;
    case 'permit':
      return node.permit.title;
  }
}

function Contents({
  node,
  api,
  open,
  readOnly,
  permissions,
}: {
  node: CatalogNode;
  api: DocumentsCatalogApi;
  open: (node: CatalogNode) => void;
  readOnly: boolean;
  permissions?: SectionPermissions;
}) {
  switch (node.type) {
    case 'catalog':
      return (
        <DocumentsCatalogList
          api={api}
          query={{ kind: 'companies' }}
          open={(company) => open({ type: 'company', company })}
        />
      );
    case 'company':
      return permissions ? (
        <CompanyHome company={node.company} permissions={permissions} readOnly={readOnly} open={open} />
      ) : (
        <Spin size="small" />
      );
    case 'contracts':
      return (
        <CatalogRows
          rows={[
            { id: 'active', title: 'Действующий', author: 'Система' },
            { id: 'inactive', title: 'Недействующий', author: 'Система' },
          ]}
          open={({ id }) => open({ type: 'contractStatus', company: node.company, active: id === 'active' })}
        />
      );
    case 'contractStatus':
      return (
        <DocumentsCatalogList
          api={api}
          query={{ kind: 'contracts', companyId: node.company.id, active: node.active }}
          open={(contract) => open({ type: 'contract', company: node.company, contract })}
        />
      );
    case 'contract':
      return (
        <RecordAttachments
          recordId={node.contract.id}
          collection="contracts"
          dataSourceKey="main"
          fields={[{ name: 'documents', title: 'Основной документ', multiple: true, readOnly: true }]}
          extraFolders={[
            {
              id: 'agreements',
              title: 'Доп. соглашение',
              open: () => open({ ...node, type: 'agreements' }),
            },
          ]}
          readOnly
        />
      );
    case 'agreements':
      return <ContractAgreements company={node.company} contract={node.contract} readOnly={readOnly} />;
    case 'customs':
      return <StandardFolders api={api} company={node.company} kind="runs" open={open} />;
    case 'unassigned':
      return (
        <DocumentsCatalogList
          api={api}
          query={{ kind: 'shipments', companyId: node.company.id }}
          open={(shipment) => open({ type: 'shipment', shipment })}
        />
      );
    case 'run':
      return (
        <RunDocuments runId={node.run.id} companyId={node.company?.id} readOnly>
          <Typography.Text strong>Поставки рейса</Typography.Text>
          <DocumentsCatalogList
            api={api}
            query={{ kind: 'shipments', companyId: node.company?.id, runId: node.run.id }}
            open={(shipment) => open({ type: 'shipment', shipment })}
          />
        </RunDocuments>
      );
    case 'shipment':
      return <ShipmentFiles shipment={node.shipment} />;
    case 'corporate':
      return (
        <CorporateFiles
          company={node.company}
          folderId={node.folderId}
          companyArea={node.companyArea}
          readOnly={readOnly}
        />
      );
    case 'permits':
      return <PermitFiles api={api} company={node.company} open={open} />;
    case 'runGroup':
    case 'permitGroup':
      if (node.folder.attachments) {
        return (
          <NativeAttachments api={api} query={{ kind: 'permitAttachments', permitIds: node.folder.attachments }} />
        );
      }
      if (node.folder.items) {
        return (
          <CatalogRows rows={node.folder.items} open={(run) => open({ type: 'run', company: node.company, run })} />
        );
      }
      return (
        <CatalogRows
          rows={(node.folder.children ?? []).map(({ id, title }) => ({ id, title, author: 'Система' }))}
          open={({ id }) => {
            const folder = node.folder.children?.find((item) => item.id === id);
            if (folder) open({ ...node, folder });
          }}
        />
      );
    case 'permit':
      return <NativeAttachments api={api} query={{ kind: 'attachments', permitId: node.permit.id }} />;
  }
}

function CompanyHome({
  company,
  permissions,
  readOnly,
  open,
}: {
  company: CatalogItem;
  permissions: SectionPermissions;
  readOnly: boolean;
  open: (node: CatalogNode) => void;
}) {
  const scope = useMemo(() => ({ companyId: company.id, companyArea: 'company' as const }), [company.id]);
  const links = (['customs', 'permits', 'contracts'] as const).filter(
    (type) => permissions.sections[type === 'customs' ? 'ved' : type],
  );
  const extraFolders = links.map((type) => {
    const node: CatalogNode = { type, company };
    return { id: `section:${type}`, title: title(node), open: () => open(node) };
  });
  return permissions.sections.company ? (
    <ScopedDocuments
      title={company.title}
      requestScope={scope}
      readOnly={readOnly}
      showRequestFolders
      extraFolders={extraFolders}
    />
  ) : (
    <CatalogRows
      rows={extraFolders.map((folder) => ({ ...folder, author: 'Система' }))}
      open={(row) => extraFolders.find(({ id }) => id === row.id)?.open()}
    />
  );
}

function StandardFolders({
  api,
  company,
  kind,
  open,
}: {
  api: DocumentsCatalogApi;
  company: CatalogItem;
  kind: 'runs' | 'permits';
  open: (node: CatalogNode) => void;
}) {
  const [folders, setFolders] = useState<CatalogFolder[]>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(undefined);
    api
      .folders(kind, company.id)
      .then((result) => {
        if (active) setFolders(result);
      })
      .catch((reason) => {
        if (active) setError(getDocumentErrorText(reason, 'Не удалось открыть папку.'));
      });
    return () => {
      active = false;
    };
  }, [api, kind, company.id, attempt]);
  if (error) {
    return (
      <Alert type="error" message={error} action={<Button onClick={() => setAttempt(attempt + 1)}>Повторить</Button>} />
    );
  }
  if (!folders) return <Spin size="small" />;
  if (!folders.length && kind === 'permits') return null;
  const type = kind === 'runs' ? 'runGroup' : 'permitGroup';
  const rows = folders.map((folder) => ({ id: folder.id, title: folder.title, author: 'Система' }));
  if (kind === 'runs') rows.push({ id: 'unassigned', title: 'Поставки без рейса', author: 'Система' });
  return (
    <CatalogRows
      rows={rows}
      open={({ id }) => {
        if (id === 'unassigned') return open({ type: 'unassigned', company });
        const folder = folders.find((item) => item.id === id);
        if (folder) open({ type, company, folder });
      }}
    />
  );
}

function ShipmentFiles({ shipment }: { shipment: CatalogItem }) {
  const scope = useMemo(() => ({ shipmentId: shipment.id }), [shipment.id]);
  return <ScopedDocuments title="Документы поставки" requestScope={scope} readOnly />;
}

function ContractAgreements({
  company,
  contract,
  readOnly,
}: {
  company: CatalogItem;
  contract: CatalogItem;
  readOnly: boolean;
}) {
  const scope = useMemo(
    () => ({ companyId: company.id, companyArea: `contract:${contract.id}` as const }),
    [company.id, contract.id],
  );
  return <ScopedDocuments title="Доп. соглашение" requestScope={scope} readOnly={readOnly} />;
}

function PermitFiles({
  api,
  company,
  open,
}: {
  api: DocumentsCatalogApi;
  company: CatalogItem;
  open: (node: CatalogNode) => void;
}) {
  const scope = useMemo(() => ({ companyId: company.id, companyArea: 'permits' as const }), [company.id]);
  return (
    <ScopedDocuments title="Разрешительные документы" requestScope={scope} readOnly>
      <StandardFolders api={api} company={company} kind="permits" open={open} />
    </ScopedDocuments>
  );
}

function CorporateFiles({
  company,
  folderId,
  readOnly,
  companyArea,
}: {
  company: CatalogItem;
  folderId?: CatalogItem['id'];
  readOnly: boolean;
  companyArea?: 'company';
}) {
  const scope = useMemo(
    () => ({ companyId: company.id, ...(companyArea && { companyArea }) }),
    [company.id, companyArea],
  );
  if (!folderId) return <CompanyRequestDocuments recordId={company.id} readOnly={readOnly} />;
  return (
    <ScopedDocuments
      title={companyArea ? company.title : 'Учредительные документы'}
      rootFolderId={folderId}
      requestScope={scope}
      readOnly={readOnly}
    />
  );
}

function NativeAttachments({
  api,
  query,
}: {
  api: DocumentsCatalogApi;
  query: Extract<CatalogQuery, { kind: 'attachments' | 'permitAttachments' }>;
}) {
  const client = useAPIClient();
  const [preview, setPreview] = useState<DocumentPreviewTarget>();
  function target(file: CatalogItem): DocumentPreviewTarget | undefined {
    const owner = query.kind === 'permitAttachments' ? file.attachmentOwnerId : query.permitId;
    if (owner === undefined) return;
    const files = new RecordAttachmentsApi(client, 'permit_documents', owner, 'documents', true, 'main');
    return { name: file.title, load: (signal) => files.open(file.id, signal) };
  }
  return (
    <>
      <DocumentsCatalogList
        fileList
        api={api}
        query={query}
        open={(file) => setPreview(target(file))}
        download={async (file) => {
          try {
            const source = target(file);
            if (source) downloadDocument(await source.load(), source.name);
          } catch (reason) {
            message.error(getDocumentErrorText(reason, 'Не удалось скачать документ.'));
          }
        }}
      />
      {preview && <DocumentPreviewDialog file={preview} onClose={() => setPreview(undefined)} />}
    </>
  );
}

export function CompanyFilesBlock({
  root,
  readOnly = false,
  openInWindow = false,
}: {
  root?: CatalogNode;
  readOnly?: boolean;
  openInWindow?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!root) return <Alert showIcon type="info" message="Проверьте настройки блока или сохраните запись." />;
  const browser = <CatalogBrowser key={JSON.stringify(root)} root={root} readOnly={readOnly} />;
  if (!openInWindow) return browser;

  return (
    <>
      <Button icon={<FolderOutlined />} onClick={() => setOpen(true)}>
        Открыть файловый менеджер
      </Button>
      <Modal
        open={open}
        title="Файловый менеджер"
        onCancel={() => setOpen(false)}
        footer={null}
        width={880}
        destroyOnClose
      >
        {browser}
      </Modal>
    </>
  );
}

function CatalogBrowser({ root, readOnly }: { root: CatalogNode; readOnly: boolean }) {
  const apiClient = useAPIClient();
  const api = useMemo(() => new DocumentsCatalogApi(apiClient), [apiClient]);
  const documentsApi = useMemo(() => new ProcessDocumentsApi(apiClient), [apiClient]);
  const [path, setPath] = useState<CatalogNode[]>([root]);
  const [editing, setEditing] = useState(false);
  const [companyAtRoot, setCompanyAtRoot] = useState(true);
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null);
  const [revision, setRevision] = useState(0);
  const [access, setAccess] = useState<{ key: string; permissions?: SectionPermissions; error?: string }>();
  const node = path[path.length - 1];
  const companyId = node.type === 'company' ? node.company.id : undefined;
  const settingsAvailable = node.type === 'catalog' || node.type === 'company';
  const accessKey = `${companyId ?? 'all'}:${revision}`;
  const currentAccess = access?.key === accessKey ? access : undefined;

  useEffect(() => {
    if (!settingsAvailable) return;
    let active = true;
    documentsApi
      .sectionPermissions(companyId)
      .then((permissions) => {
        if (active) setAccess({ key: accessKey, permissions });
      })
      .catch((reason) => {
        if (active) setAccess({ key: accessKey, error: getDocumentErrorText(reason, 'Не удалось проверить доступ.') });
      });
    return () => {
      active = false;
    };
  }, [documentsApi, companyId, settingsAvailable, accessKey]);

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <nav aria-label="Путь к документам">
          <Space wrap size={4}>
            {path.map((entry, index) => (
              <React.Fragment key={index}>
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                {index === path.length - 1 ? (
                  <Typography.Text strong aria-current="page">
                    {title(entry)}
                  </Typography.Text>
                ) : (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      setCompanyAtRoot(true);
                      setPath((previous) => previous.slice(0, index + 1));
                    }}
                  >
                    {title(entry)}
                  </Button>
                )}
              </React.Fragment>
            ))}
          </Space>
        </nav>
        <div
          role="group"
          aria-label="Действия файлового менеджера"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 8,
            marginInlineStart: 'auto',
          }}
        >
          {currentAccess?.permissions?.canManageAccess &&
            !readOnly &&
            settingsAvailable &&
            (node.type !== 'company' || companyAtRoot) && (
              <Button icon={<LockOutlined />} onClick={() => setEditing(true)}>
                Права на документы
              </Button>
            )}
          <div ref={setToolbarTarget} style={{ display: 'contents' }} />
        </div>
      </div>
      {editing && (
        <DocumentSectionAccessDialog
          api={documentsApi}
          company={node.type === 'company' ? node.company : undefined}
          onClose={() => setEditing(false)}
          onSaved={() => setRevision((previous) => previous + 1)}
        />
      )}
      {node.type === 'company' && currentAccess?.error ? (
        <Alert
          type="error"
          showIcon
          message={currentAccess.error}
          action={<Button onClick={() => setRevision((previous) => previous + 1)}>Повторить</Button>}
        />
      ) : (
        <DocumentCatalogContext.Provider
          value={{
            path: path.map(title),
            manageAccess: !readOnly,
            toolbarTarget,
            onCompanyFolderLocationChange: setCompanyAtRoot,
          }}
        >
          <Contents
            key={JSON.stringify(node)}
            api={api}
            node={node}
            readOnly={readOnly}
            permissions={currentAccess?.permissions}
            open={(entry) => {
              setCompanyAtRoot(true);
              setPath((previous) => [...previous, entry]);
            }}
          />
        </DocumentCatalogContext.Provider>
      )}
    </Space>
  );
}
