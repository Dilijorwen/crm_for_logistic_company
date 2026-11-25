/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  catalogNodeKey,
  catalogSearchMaxLength,
  catalogSearchMinLength,
  catalogSearchPageSize,
  type CatalogFileLocation,
  type CatalogSearchHit,
  type CatalogSearchRequest,
  type CatalogSearchResponse,
} from '../../contracts/documentCatalog';
import { documentRecordId } from '../../contracts/processDocuments';
import { ProcessDocumentsError } from '../domain/documents/DocumentErrors';
import type { DocumentActor } from './ports/ProcessDocumentsRepository';

type SearchSource = 'scoped' | 'attachment';
export interface CatalogSearchCursor {
  source: SearchSource;
  id: string;
}

export interface CatalogSearchCandidate extends CatalogSearchCursor {
  title: string;
  createdAt?: string;
  file_size?: number;
  author?: string;
}

export interface CatalogSearchReader {
  candidates(query: string, cursor: CatalogSearchCursor | undefined, limit: number): Promise<CatalogSearchCandidate[]>;
  locations(candidate: CatalogSearchCandidate): Promise<CatalogFileLocation[]>;
}

function invalidSearch(): never {
  throw new ProcessDocumentsError('INVALID_DOCUMENT_SEARCH', 'Проверьте параметры поиска файлов.');
}

export function parseCatalogSearch(values: Record<string, unknown>): CatalogSearchRequest {
  const { query, path, folderId, cursor } = values;
  if (typeof query !== 'string' || query.length > catalogSearchMaxLength) invalidSearch();
  if (!Array.isArray(path) || path.length > 12 || !path.every((key) => typeof key === 'string' && key.length <= 100)) {
    invalidSearch();
  }
  if (folderId !== undefined && !documentRecordId(folderId)) invalidSearch();
  if (cursor !== undefined && (typeof cursor !== 'string' || cursor.length > 40)) invalidSearch();
  return { query, path, folderId: documentRecordId(folderId), cursor: typeof cursor === 'string' ? cursor : undefined };
}

function parseCursor(cursor: string | undefined): CatalogSearchCursor | undefined {
  if (!cursor) return;
  const [source, id, extra] = cursor.split(':');
  if (extra !== undefined || (source !== 'scoped' && source !== 'attachment') || !documentRecordId(id)) invalidSearch();
  return { source, id };
}

function matchesLocation(location: CatalogFileLocation, request: CatalogSearchRequest): boolean {
  const keys = location.nodes.map(catalogNodeKey);
  const scope = request.path;
  const matchesPath =
    !scope.length || keys.some((_, index) => scope.every((key, offset) => keys[index + offset] === key));
  return matchesPath && (!request.folderId || location.folders.some(({ id }) => id === request.folderId));
}

export class SearchCatalogDocuments {
  constructor(
    private readonly readerFor: (actor: DocumentActor, request: CatalogSearchRequest) => CatalogSearchReader,
  ) {}

  async execute(request: CatalogSearchRequest, actor: DocumentActor): Promise<CatalogSearchResponse> {
    const query = request.query.trim();
    if (
      query.length < catalogSearchMinLength ||
      query.length > catalogSearchMaxLength ||
      Array.from(query).some((character) => character.charCodeAt(0) < 32)
    ) {
      invalidSearch();
    }
    const reader = this.readerFor(actor, request);
    const rows: CatalogSearchHit[] = [];
    let cursor = parseCursor(request.cursor);
    let next: string | undefined;
    const batchSize = 64;
    let candidates = await reader.candidates(query, cursor, batchSize);
    while (candidates.length) {
      for (const candidate of candidates) {
        const location = (await reader.locations(candidate)).find((item) => matchesLocation(item, request));
        if (!location) continue;
        if (rows.length === catalogSearchPageSize) return { rows, next };
        const { id, title, createdAt, file_size, author } = candidate;
        rows.push({ id, title, createdAt, file_size, author, ...location });
        next = `${candidate.source}:${id}`;
      }
      if (candidates.length < batchSize) return { rows };
      cursor = candidates[candidates.length - 1];
      candidates = await reader.candidates(query, cursor, batchSize);
    }
    return { rows };
  }
}
