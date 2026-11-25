/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database, Filter, Model } from '@nocobase/database';
import { permitCatalogFolders, runCatalogFolders, runCatalogTitle } from '../../../contracts/catalogFolders';
import type {
  CatalogFileLocation,
  CatalogFolder,
  CatalogItem,
  CatalogNode,
  CatalogSearchRequest,
} from '../../../contracts/documentCatalog';
import {
  companyRequestFolderTypes,
  contractAreaId,
  documentRecordId,
  isCompanyRequestFolder,
} from '../../../contracts/processDocuments';
import type { DocumentScopeService, ResolveDocumentScopeInput } from '../../application/DocumentScopeService';
import type { DocumentActor } from '../../application/ports/ProcessDocumentsRepository';
import type {
  CatalogSearchCandidate,
  CatalogSearchCursor,
  CatalogSearchReader,
} from '../../application/SearchCatalogDocuments';
import { ProcessDocumentsError } from '../../domain/documents/DocumentErrors';
import type { NocoBaseProcessDocumentAccess } from './NocoBaseProcessDocumentAccess';
import { attachmentSearchName, catalogSearchTable } from './catalogSearchSql';

type Candidate = CatalogSearchCandidate & {
  folderId?: string;
  companyId?: string;
  companyArea?: ResolveDocumentScopeInput['companyArea'];
  runId?: string;
  shipmentId?: string;
};

interface CandidateRow {
  id: string;
  name: string;
  createdAt: Date | string | null;
  size: string | number | null;
  author?: string;
  folder_id?: string | null;
  company_id?: string | null;
  company_area?: Candidate['companyArea'];
  transport_run_id?: string | null;
  shipment_id?: string | null;
}

type Row = Record<string, unknown>;
type ContractPath = [
  { type: 'company'; company: CatalogItem },
  { type: 'contracts'; company: CatalogItem },
  { type: 'contractStatus'; company: CatalogItem; active: boolean },
  { type: 'contract'; company: CatalogItem; contract: CatalogItem },
];

const unavailableCodes = new Set([
  'DOCUMENT_ACCESS_DENIED',
  'SHIPMENT_ACCESS_DENIED',
  'SHIPMENT_NOT_FOUND',
  'OWNER_NOT_FOUND',
  'FOLDER_NOT_FOUND',
  'CROSS_SCOPE_FOLDER',
]);

function record(value: unknown): Row {
  return typeof value === 'object' && value !== null ? (value as Row) : {};
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function locateFolder(
  folders: CatalogFolder[],
  includes: (folder: CatalogFolder) => boolean,
): CatalogFolder[] | undefined {
  for (const folder of folders) {
    if (includes(folder)) return [folder];
    const children = folder.children && locateFolder(folder.children, includes);
    if (children) return [folder, ...children];
  }
}

export class NocoBaseCatalogSearch implements CatalogSearchReader {
  private readonly cache = new Map<string, Promise<unknown>>();

  constructor(
    private readonly database: Database,
    private readonly scopes: DocumentScopeService,
    private readonly access: NocoBaseProcessDocumentAccess,
    private readonly actor: DocumentActor,
    private readonly request: CatalogSearchRequest,
  ) {}

  async candidates(query: string, cursor: CatalogSearchCursor | undefined, limit: number): Promise<Candidate[]> {
    const pattern = `%${query.replace(/[!%_]/g, '!$&')}%`;
    const scope = this.request.path;
    const scopedOnly =
      this.request.folderId ||
      scope.some((key) => /^(corporate:|customs:|unassigned:|run:|shipment:|agreements:)/.test(key));
    const nativeOnly = scope.some((key) => /^(permit:|permitGroup:)/.test(key));
    const scoped =
      cursor?.source === 'attachment' || nativeOnly ? [] : await this.searchRows('scoped', cursor?.id, pattern, limit);
    if (scoped.length === limit || scopedOnly) return scoped;
    const attachments = await this.searchRows(
      'attachment',
      cursor?.source === 'attachment' ? cursor.id : undefined,
      pattern,
      limit - scoped.length,
    );
    return [...scoped, ...attachments];
  }

  private async searchRows(source: Candidate['source'], after: string | undefined, pattern: string, limit: number) {
    const isScoped = source === 'scoped';
    const collection = this.database.getCollection(isScoped ? 'process_documents' : 'attachments');
    if (!collection) return [];
    const table = catalogSearchTable(this.database, collection);
    const name = isScoped ? '"title"' : attachmentSearchName;
    const users = this.database.getCollection('users');
    const author = users
      ? `, (select coalesce(nickname, username) from ${catalogSearchTable(this.database, users)}
         where id = candidate."createdById") as author`
      : '';
    const scopeFields = isScoped ? ', folder_id, company_id, company_area, transport_run_id, shipment_id' : '';
    const folderId = isScoped ? this.request.folderId : undefined;
    const folders = this.database.getCollection('process_document_folders');
    const folderTree =
      folderId && folders
        ? `with recursive folder_tree(id) as (
          select cast(:folderId as bigint)
          union
          select child.id from ${catalogSearchTable(this.database, folders)} as child
          join folder_tree parent on child.parent_folder_id = parent.id
        )`
        : '';
    const candidateFilter = isScoped
      ? 'and draft_token is null and (company_id is not null or transport_run_id is not null or shipment_id is not null)'
      : '';
    const [results] = await this.database.sequelize.query(
      `${folderTree}
       select id::text as id, ${name} as name, "createdAt", ${
         isScoped ? 'file_size' : 'size'
       } as size${scopeFields}${author}
       from ${table} as candidate
       where ${name} ilike :pattern escape '!' ${candidateFilter} ${after ? 'and id < :after' : ''}
       ${folderTree ? 'and folder_id in (select id from folder_tree)' : ''}
       order by candidate.id desc limit :limit`,
      { replacements: { pattern, after, folderId, limit } },
    );
    return (results as CandidateRow[]).map(
      (row): Candidate => ({
        id: row.id,
        title: row.name,
        source,
        author: row.author,
        ...(row.createdAt && { createdAt: new Date(row.createdAt).toISOString() }),
        ...(row.size != null && { file_size: Number(row.size) }),
        folderId: documentRecordId(row.folder_id),
        companyId: documentRecordId(row.company_id),
        companyArea: row.company_area,
        runId: documentRecordId(row.transport_run_id),
        shipmentId: documentRecordId(row.shipment_id),
      }),
    );
  }

  async locations(candidate: Candidate): Promise<CatalogFileLocation[]> {
    try {
      return candidate.source === 'scoped'
        ? await this.scopedLocations(candidate)
        : await this.attachmentLocations(candidate.id);
    } catch (error) {
      if (error instanceof ProcessDocumentsError && unavailableCodes.has(error.code)) return [];
      throw error;
    }
  }

  private async scopedLocations(file: Candidate): Promise<CatalogFileLocation[]> {
    const { companyId, companyArea, runId, shipmentId, folderId } = file;
    const sections = await this.memo(['scoped', companyId, companyArea, runId, shipmentId], () =>
      this.scopedPaths(file),
    );
    if (!sections.length) return [];

    const folders = await this.memo(['folders', companyId, companyArea, runId, shipmentId, folderId], async () => {
      const firstRun = sections[0].find((node): node is Extract<CatalogNode, { type: 'run' }> => node.type === 'run');
      const scope = await this.scopes.resolve({
        companyId: runId ? firstRun?.company?.id.toString() : companyId,
        companyArea,
        runId,
        shipmentId: shipmentId ?? null,
        draftToken: null,
        operation: 'read',
        actor: this.actor,
      });
      await this.scopes.assertFolderAccess(folderId ?? null, scope, 'read', this.actor);
      return this.scopes.getBreadcrumbs(folderId ?? null, scope);
    });

    const standalone = this.request.path[0];
    const company = sections[0][0];
    if (standalone?.startsWith('corporate:') && company?.type === 'company') {
      const requestFolder = folders[0] && isCompanyRequestFolder(folders[0].title);
      if (this.request.folderId || (requestFolder && folders[1]?.title === companyRequestFolderTypes.our_companies)) {
        return [{ nodes: [{ type: 'corporate', company: company.company }], folders, target: { kind: 'scoped' } }];
      }
      return [];
    }
    return sections.map((nodes) => ({ nodes, folders, target: { kind: 'scoped' } }));
  }

  private async scopedPaths({ companyId, companyArea, runId, shipmentId }: Candidate): Promise<CatalogNode[][]> {
    if (runId) return this.runPaths(runId);
    if (shipmentId) {
      const shipment = await this.readOne('shipments', shipmentId, {
        fields: ['id', 'shipment_number', 'company_id'],
        appends: ['runs.id'],
      });
      if (!shipment) return [];
      const node: CatalogNode = {
        type: 'shipment',
        shipment: { id: shipmentId, title: `Поставка №${shipment.shipment_number ?? shipmentId}` },
      };
      if (this.request.path[0] === `shipment:${shipmentId}`) return [[node]];
      const owner = await this.company(documentRecordId(shipment.company_id));
      if (!owner || !(await this.companySections(String(owner.id))).sections.ved) return [];
      const runs = rows(shipment.runs);
      if (!runs.length)
        return [
          [
            { type: 'company', company: owner },
            { type: 'customs', company: owner },
            { type: 'unassigned', company: owner },
            node,
          ],
        ];
      const paths = await Promise.all(
        runs.map(async (run) => {
          const id = documentRecordId(run.id);
          return id ? this.runPaths(id, String(owner.id)) : [];
        }),
      );
      return paths.flat().map((path) => [...path, node]);
    }
    const company = await this.company(companyId);
    if (!company) return [];
    const home: CatalogNode = { type: 'company', company };
    if (companyArea === 'permits') return [[home, { type: 'permits', company }]];
    const contractId = contractAreaId(companyArea);
    if (contractId) {
      const contracts = await this.contractPaths(contractId, company);
      return contracts.map((path) => [...path, { ...path[3], type: 'agreements' }]);
    }
    if (
      companyArea === 'company' ||
      (companyArea === undefined && this.request.folderId && this.request.path[0]?.startsWith('corporate:'))
    ) {
      return [[home]];
    }
    return [];
  }

  private runPaths(runId: string, companyId?: string): Promise<CatalogNode[][]> {
    return this.memo(['run', runId, companyId], async () => {
      const run = await this.readOne('transport_runs', runId, {
        fields: ['id', 'run_number'],
        appends: ['shipments.id', 'shipments.createdAt', 'shipments.company_id', 'vehicle.registration_number'],
      });
      if (!run) return [];
      const item = { id: runId, title: runCatalogTitle(run, runId) };
      if (this.request.path[0] === `run:${runId}` && !companyId) return [[{ type: 'run', run: item }]];
      const companies = new Set(rows(run.shipments).map((shipment) => documentRecordId(shipment.company_id)));
      const folders = locateFolder(runCatalogFolders([run]), (folder) => !!folder.items);
      if (!folders) return [];
      const paths: CatalogNode[][] = [];
      for (const id of companies) {
        if (!id || (companyId && id !== companyId)) continue;
        const company = await this.company(id);
        if (!company || !(await this.companySections(id)).sections.ved) continue;
        paths.push([
          { type: 'company', company },
          { type: 'customs', company },
          ...folders.map((folder): CatalogNode => ({ type: 'runGroup', company, folder })),
          { type: 'run', company, run: item },
        ]);
      }
      return paths;
    });
  }

  private contractPaths(id: string, company: CatalogItem): Promise<ContractPath[]> {
    return this.memo(['contract', id, company.id], async () => {
      const contract = await this.readOne('contracts', id, {
        fields: ['id', 'name', 'is_active'],
        filter: { 'importers.id': company.id },
      });
      if (!contract || !(await this.companySections(String(company.id))).sections.contracts) return [];
      return [
        [
          { type: 'company', company },
          { type: 'contracts', company },
          { type: 'contractStatus', company, active: contract.is_active === true },
          { type: 'contract', company, contract: { id, title: String(contract.name ?? id) } },
        ],
      ];
    });
  }

  private async attachmentLocations(id: string): Promise<CatalogFileLocation[]> {
    const locations: CatalogFileLocation[] = [];
    for (const collection of ['contracts', 'permit_documents'] as const) {
      if (!this.database.getCollection(collection)?.getField('documents')) continue;
      const permissions = await this.permission(collection, 'get', 'documents');
      if (!permissions) continue;
      const owners = await this.database.getRepository(collection).find({
        fields: collection === 'contracts' ? ['id'] : ['id', 'company_id', 'title'],
        ...(collection === 'contracts' && { appends: ['importers.id'] }),
        filter: { $and: [permissions, { 'documents.id': id }] },
        sort: ['id'],
      });
      for (const owner of owners) {
        const row = record(owner.toJSON());
        const ownerId = documentRecordId(row.id);
        if (!ownerId) continue;
        const section = collection === 'contracts' ? 'contracts' : 'permits';
        if (!(await this.attachmentReadable(section, ownerId))) continue;
        const target = { kind: 'attachment' as const, collection, ownerId };
        if (collection === 'contracts') {
          for (const companyRef of rows(row.importers)) {
            const company = await this.company(documentRecordId(companyRef.id));
            if (!company) continue;
            const paths = await this.contractPaths(ownerId, company);
            for (const nodes of paths) locations.push({ nodes, folders: [], target });
          }
        } else {
          const nodes = await this.permitPath(ownerId, row);
          if (nodes) locations.push({ nodes, folders: [], target });
        }
      }
    }
    return locations;
  }

  private attachmentReadable(section: 'contracts' | 'permits', id: string) {
    return this.memo(['attachment', section, id], async () => {
      try {
        await this.access.assertAttachmentSection(section, id, 'read', this.actor);
        return true;
      } catch (error) {
        if (error instanceof ProcessDocumentsError && unavailableCodes.has(error.code)) return false;
        throw error;
      }
    });
  }

  private async permitPath(id: string, row: Row): Promise<CatalogNode[] | undefined> {
    if (this.request.path[0] === `permit:${id}`) {
      return [{ type: 'permit', permit: { id, title: String(row.title ?? 'Разрешительный документ') } }];
    }
    const companyId = documentRecordId(row.company_id);
    const company = await this.company(companyId);
    if (!company || !companyId || !(await this.companySections(companyId)).sections.permits) return;
    const folders = await this.memo(['permit-folders', companyId], async () => {
      const permissions = await this.permission('permit_documents', 'list');
      if (!permissions) return [];
      const items: Model[] = await this.database.getRepository('permit_documents').find({
        fields: ['id', 'status', 'internal_number', 'document_type'],
        filter: { $and: [permissions, { company_id: companyId }] },
        sort: ['id'],
      });
      return permitCatalogFolders(items.map((item) => record(item.toJSON())));
    });
    const path = locateFolder(folders, (folder) => !!folder.attachments?.some((owner) => String(owner) === id));
    if (!path) return;
    return [
      { type: 'company', company },
      { type: 'permits', company },
      ...path.map((folder): CatalogNode => ({ type: 'permitGroup', company, folder })),
    ];
  }

  private async company(id: string | undefined): Promise<CatalogItem | undefined> {
    if (!id) return;
    const row = await this.readOne('our_companies', id, { fields: ['id', 'name'] });
    return row && { id, title: String(row.name ?? id) };
  }

  private companySections(id: string) {
    return this.memo(['sections', id], () => this.access.sectionPermissions(id, this.actor));
  }

  private permission(collection: string, action: 'list' | 'get', field?: string) {
    return this.memo(['permission', collection, action, field], () =>
      this.access.permissionFilter(collection, action, this.actor, field),
    );
  }

  private readOne(collection: string, id: string, options: { fields: string[]; appends?: string[]; filter?: Filter }) {
    return this.memo(['owner', collection, id, options], async () => {
      if (!this.database.hasCollection(collection)) return;
      const permissions = await this.permission(collection, 'get');
      const list = await this.permission(collection, 'list');
      if (!permissions || (!list && !this.request.path[0]?.match(/^(run|shipment|permit|corporate):/))) return;
      const row = await this.database.getRepository(collection).findOne({
        ...options,
        filter: { $and: [permissions, list ?? {}, { id }, options.filter ?? {}] },
      });
      return row && record(row.toJSON());
    });
  }

  private memo<T>(key: unknown[], load: () => Promise<T>): Promise<T> {
    const identifier = JSON.stringify(key);
    const existing = this.cache.get(identifier);
    if (existing) return existing as Promise<T>;
    const value = load();
    this.cache.set(identifier, value);
    return value;
  }
}
