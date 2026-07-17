export type ProcessDocumentsErrorCode =
  | 'PROCESS_REQUIRED'
  | 'PROCESS_NOT_FOUND'
  | 'FOLDER_NOT_FOUND'
  | 'DOCUMENT_NOT_FOUND'
  | 'INVALID_DRAFT_TOKEN'
  | 'PROCESS_ACCESS_DENIED'
  | 'DRAFT_ACCESS_DENIED'
  | 'CROSS_SCOPE_FOLDER'
  | 'FOLDER_TITLE_REQUIRED'
  | 'FILES_REQUIRED'
  | 'FOLDER_SELF_PARENT'
  | 'FOLDER_CYCLE'
  | 'STORAGE_UPLOAD_FAILED';

export class ProcessDocumentsError extends Error {
  constructor(
    readonly code: ProcessDocumentsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProcessDocumentsError';
  }
}
