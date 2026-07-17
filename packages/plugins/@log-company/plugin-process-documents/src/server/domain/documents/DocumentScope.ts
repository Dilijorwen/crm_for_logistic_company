import { ProcessDocumentsError } from './DocumentErrors';

export type DocumentScope = { mode: 'process'; processId: string } | { mode: 'draft'; draftToken: string };

export interface ScopedRecord {
  processId: string | null;
  draftToken: string | null;
}

export function parseIdentifier(value: unknown): string | null {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return parseIdentifier(objectValue.id ?? objectValue.value ?? objectValue.filterByTk);
  }
  return String(value);
}

export function parseDraftToken(value: unknown): string | null {
  const token = parseIdentifier(value)?.trim();
  if (!token || !/^[a-zA-Z0-9_-]{16,120}$/.test(token)) {
    return null;
  }
  return token;
}

export function normalizeNullableIdentifier(value: unknown): string | null {
  return parseIdentifier(value);
}

export function recordMatchesScope(record: ScopedRecord, scope: DocumentScope): boolean {
  if (scope.mode === 'process') {
    return record.processId === scope.processId;
  }
  return record.processId === null && record.draftToken === scope.draftToken;
}

export function assertRecordMatchesScope(record: ScopedRecord, scope: DocumentScope): void {
  if (!recordMatchesScope(record, scope)) {
    throw new ProcessDocumentsError('CROSS_SCOPE_FOLDER', 'Нельзя использовать папку другого таможенного процесса.');
  }
}

export function assertDraftOwner(
  record: ScopedRecord & { createdById: string | null },
  scope: DocumentScope,
  actor: { userId: string | null; isRoot: boolean },
): void {
  if (scope.mode !== 'draft' || record.draftToken !== scope.draftToken) {
    throw new ProcessDocumentsError('DRAFT_ACCESS_DENIED', 'Нет прав для действия с черновыми документами процесса.');
  }
  if (actor.isRoot || (actor.userId !== null && record.createdById === actor.userId)) {
    return;
  }
  throw new ProcessDocumentsError('DRAFT_ACCESS_DENIED', 'Нет прав для действия с черновыми документами процесса.');
}
