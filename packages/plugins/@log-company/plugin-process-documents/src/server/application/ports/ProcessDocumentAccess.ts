import type { DocumentActor } from './ProcessDocumentsRepository';

export type ProcessDocumentOperation = 'read' | 'write' | 'delete';

export interface ProcessDocumentAccess {
  assertAccess(processId: string, operation: ProcessDocumentOperation, actor: DocumentActor): Promise<void>;
}
