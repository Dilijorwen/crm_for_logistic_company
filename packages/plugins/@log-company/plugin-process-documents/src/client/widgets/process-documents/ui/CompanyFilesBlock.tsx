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
import { Alert, Button, Empty, Modal, Space, Spin, Typography, message } from 'antd';
import { FolderOutlined, LockOutlined } from '@ant-design/icons';
import { DocumentsCatalogApi, ProcessDocumentsApi, getDocumentErrorText } from '../../../entities/process-document';
import type { CatalogFolder, CatalogItem, CatalogQuery } from '../../../entities/process-document';
import type { SectionPermissions } from '../../../../contracts/processDocuments';
import { DocumentSectionAccessDialog } from './DocumentSectionAccessDialog';
import { DocumentsCatalogList } from './DocumentsCatalogList';
import { RunDocuments } from './RunDocuments';
import { ScopedDocuments } from './ScopedDocuments';

export type CatalogNode =
  | { type: 'catalog' }
  | { type: 'company' | 'customs' | 'unassigned' | 'permits'; company: CatalogItem }
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

function FolderButton({ node, open }: { node: CatalogNode; open: (node: CatalogNode) => void }) {
  return (
    <Button type="text" icon={<FolderOutlined aria-hidden="true" />} onClick={() => open(node)}>
      {title(node)}
    </Button>
  );
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
    case 'customs':
      return (
        <>
          <FolderButton node={{ type: 'unassigned', company: node.company }} open={open} />
          <StandardFolders api={api} company={node.company} kind="runs" open={open} />
        </>
      );
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
        <RunDocuments runId={node.run.id} companyId={node.company?.id} readOnly={readOnly}>
          <Typography.Text strong>Поставки рейса</Typography.Text>
          <DocumentsCatalogList
            api={api}
            query={{ kind: 'shipments', companyId: node.company?.id, runId: node.run.id }}
            open={(shipment) => open({ type: 'shipment', shipment })}
          />
        </RunDocuments>
      );
    case 'shipment':
      return <ShipmentFiles shipment={node.shipment} readOnly={readOnly} />;
    case 'corporate':
      return (
        <CorporateFiles
          api={api}
          company={node.company}
          folderId={node.folderId}
          companyArea={node.companyArea}
          readOnly={readOnly}
        />
      );
    case 'permits':
      return <StandardFolders api={api} company={node.company} kind="permits" open={open} />;
    case 'runGroup':
    case 'permitGroup':
      return (
        <Space direction="vertical">
          {node.folder.children?.map((folder) => (
            <FolderButton key={folder.id} node={{ ...node, folder }} open={open} />
          ))}
          {node.folder.items?.map((run) => (
            <FolderButton key={run.id} node={{ type: 'run', company: node.company, run }} open={open} />
          ))}
          {node.folder.attachments && (
            <NativeAttachments api={api} query={{ kind: 'permitAttachments', permitIds: node.folder.attachments }} />
          )}
        </Space>
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
  const links = (['customs', 'permits', 'corporate'] as const).filter(
    (type) => permissions.sections[type === 'customs' ? 'ved' : type],
  );
  const sections = links.length ? (
    <Space direction="vertical">
      {links.map((type) => (
        <FolderButton key={type} node={{ type, company }} open={open} />
      ))}
    </Space>
  ) : null;
  return permissions.sections.company ? (
    <ScopedDocuments title={company.title} requestScope={scope} readOnly={readOnly}>
      {sections}
    </ScopedDocuments>
  ) : (
    sections
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
  if (!folders.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Папка пуста" />;
  const type = kind === 'runs' ? 'runGroup' : 'permitGroup';
  return (
    <Space direction="vertical">
      {folders.map((folder) => (
        <FolderButton key={folder.id} node={{ type, company, folder }} open={open} />
      ))}
    </Space>
  );
}

function ShipmentFiles({ shipment, readOnly }: { shipment: CatalogItem; readOnly: boolean }) {
  const scope = useMemo(() => ({ shipmentId: shipment.id }), [shipment.id]);
  return <ScopedDocuments title="Документы поставки" requestScope={scope} readOnly={readOnly} />;
}

function CorporateFiles({
  api,
  company,
  folderId,
  readOnly,
  companyArea,
}: {
  api: DocumentsCatalogApi;
  company: CatalogItem;
  folderId?: CatalogItem['id'];
  readOnly: boolean;
  companyArea?: 'company';
}) {
  const scope = useMemo(
    () => ({ companyId: company.id, ...(companyArea && { companyArea }) }),
    [company.id, companyArea],
  );
  return (
    <ScopedDocuments
      title={companyArea ? company.title : 'Учредительные документы'}
      rootFolderId={folderId}
      requestScope={scope}
      readOnly={readOnly}
    >
      {!folderId ? (
        <details>
          <summary>Документы из карточки компании</summary>
          <NativeAttachments api={api} query={{ kind: 'companyAttachments', companyId: company.id }} />
        </details>
      ) : null}
    </ScopedDocuments>
  );
}

function NativeAttachments({
  api,
  query,
}: {
  api: DocumentsCatalogApi;
  query: Extract<CatalogQuery, { kind: 'attachments' | 'companyAttachments' | 'permitAttachments' }>;
}) {
  return (
    <DocumentsCatalogList
      fileList
      api={api}
      query={query}
      open={async (file) => {
        try {
          let owner: Extract<CatalogQuery, { kind: 'attachments' | 'companyAttachments' }>;
          if (query.kind === 'permitAttachments') {
            if (file.attachmentOwnerId === undefined) throw new Error('Карточка разрешительного документа недоступна.');
            owner = { kind: 'attachments', permitId: file.attachmentOwnerId };
          } else owner = query;
          window.location.assign(await api.attachmentDownload(owner, file.id));
        } catch (error) {
          message.error(getDocumentErrorText(error, 'Не удалось открыть файл.'));
        }
      }}
    />
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
                <Button type="link" size="small" onClick={() => setPath((previous) => previous.slice(0, index + 1))}>
                  {title(entry)}
                </Button>
              )}
            </React.Fragment>
          ))}
        </Space>
      </nav>
      {currentAccess?.permissions?.canManageAccess && !readOnly && settingsAvailable && (
        <Button icon={<LockOutlined />} onClick={() => setEditing(true)}>
          Права на документы
        </Button>
      )}
      {editing && (
        <DocumentSectionAccessDialog
          api={documentsApi}
          catalogApi={api}
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
        <Contents
          key={JSON.stringify(node)}
          api={api}
          node={node}
          readOnly={readOnly}
          permissions={currentAccess?.permissions}
          open={(entry) => setPath((previous) => [...previous, entry])}
        />
      )}
    </Space>
  );
}
