import type { DocumentScope } from '../../domain/documents/DocumentScope';

export type TransactionContext = unknown;

export interface DocumentActor {
  userId: string | null;
  isRoot: boolean;
  authorizationContext: unknown;
}

export interface DocumentFolderRecord {
  id: string;
  title: string;
  processId: string | null;
  draftToken: string | null;
  parentFolderId: string | null;
  createdById: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  author?: string;
}

export interface ProcessDocumentRecord {
  id: string;
  title: string;
  originalFilename: string;
  processId: string | null;
  draftToken: string | null;
  folderId: string | null;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  createdById: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  author?: string;
}

export interface CreateFolderRecordInput {
  id: string;
  title: string;
  scope: DocumentScope;
  parentFolderId: string | null;
  actorId: string | null;
}

export interface CreateDocumentRecordInput {
  id: string;
  title: string;
  originalFilename: string;
  scope: DocumentScope;
  folderId: string | null;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  actorId: string | null;
}

export interface ProcessDocumentsRepository {
  withTransaction<T>(work: (transaction: TransactionContext) => Promise<T>): Promise<T>;
  processExists(processId: string, transaction?: TransactionContext): Promise<boolean>;
  draftHasRecordsOwnedByOther(draftToken: string, actorId: string): Promise<boolean>;
  findFolderById(id: string, transaction?: TransactionContext): Promise<DocumentFolderRecord | null>;
  findDocumentById(id: string, transaction?: TransactionContext): Promise<ProcessDocumentRecord | null>;
  listFolders(scope: DocumentScope, parentFolderId: string | null): Promise<DocumentFolderRecord[]>;
  listDocuments(scope: DocumentScope, folderId: string | null): Promise<ProcessDocumentRecord[]>;
  listChildFolders(
    scope: DocumentScope,
    parentFolderId: string,
    transaction?: TransactionContext,
  ): Promise<DocumentFolderRecord[]>;
  listFolderTitles(
    scope: DocumentScope,
    parentFolderId: string | null,
    transaction?: TransactionContext,
  ): Promise<string[]>;
  listDocumentTitles(
    scope: DocumentScope,
    folderId: string | null,
    transaction?: TransactionContext,
  ): Promise<string[]>;
  listDocumentsInFolders(
    scope: DocumentScope,
    folderIds: string[],
    transaction?: TransactionContext,
  ): Promise<ProcessDocumentRecord[]>;
  createFolder(input: CreateFolderRecordInput, transaction?: TransactionContext): Promise<DocumentFolderRecord>;
  createDocument(input: CreateDocumentRecordInput, transaction?: TransactionContext): Promise<ProcessDocumentRecord>;
  deleteFolder(id: string, transaction?: TransactionContext): Promise<void>;
  deleteDocument(id: string, transaction?: TransactionContext): Promise<void>;
  attachDraftToProcess(draftToken: string, processId: string, transaction?: TransactionContext): Promise<void>;
}
