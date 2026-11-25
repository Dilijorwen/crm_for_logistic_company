/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type CatalogId = string | number;
export interface CatalogItem {
  id: CatalogId;
  title: string;
  attachmentOwnerId?: CatalogId;
  createdAt?: string;
  author?: string;
  file_size?: number;
}
export interface CatalogFolder {
  id: string;
  title: string;
  children?: CatalogFolder[];
  items?: CatalogItem[];
  attachments?: CatalogId[];
}
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

export function catalogNodeTitle(node: CatalogNode): string {
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

export function catalogNodeKey(node: CatalogNode): string {
  const companyId = 'company' in node ? node.company?.id : undefined;
  if (node.type === 'run') return `run:${node.run.id}`;
  if (node.type === 'shipment') return `shipment:${node.shipment.id}`;
  if (node.type === 'permit') return `permit:${node.permit.id}`;
  if (node.type === 'runGroup' || node.type === 'permitGroup') return `${node.type}:${node.folder.id}`;
  if (node.type === 'contract' || node.type === 'agreements') return `${node.type}:${node.contract.id}`;
  if (node.type === 'contractStatus') return `contractStatus:${node.active}`;
  return companyId === undefined ? node.type : `${node.type}:${companyId}`;
}

export const catalogSearchPageSize = 50;
export const catalogSearchMinLength = 2;
export const catalogSearchMaxLength = 200;

export interface CatalogSearchRequest {
  query: string;
  path: string[];
  folderId?: string;
  cursor?: string;
}

export type CatalogFileTarget =
  | { kind: 'scoped' }
  | { kind: 'attachment'; collection: 'contracts' | 'permit_documents'; ownerId: string };

export interface CatalogFileLocation {
  nodes: CatalogNode[];
  folders: Array<{ id: string; title: string }>;
  target: CatalogFileTarget;
}

export interface CatalogSearchHit extends CatalogItem, CatalogFileLocation {
  id: string;
}

export interface CatalogSearchResponse {
  rows: CatalogSearchHit[];
  next?: string;
}
