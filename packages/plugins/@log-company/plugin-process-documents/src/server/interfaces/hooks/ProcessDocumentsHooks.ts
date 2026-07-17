import type { Plugin } from '@nocobase/server';
import { AttachDraftDocumentsToProcess } from '../../application/AttachDraftDocumentsToProcess';
import { ValidateDocumentFolderPlacement } from '../../application/ValidateDocumentFolderPlacement';
import { ValidateProcessDocumentPlacement } from '../../application/ValidateProcessDocumentPlacement';
import type { ApplicationLogger, DocumentStorage } from '../../application/ports/DocumentStorage';
import type {
  ProcessDocumentsRepository,
  TransactionContext,
} from '../../application/ports/ProcessDocumentsRepository';
import { ProcessDocumentsError } from '../../domain/documents/DocumentErrors';
import { parseDraftToken, parseIdentifier, type DocumentScope } from '../../domain/documents/DocumentScope';

const PROCESS_COLLECTION = 'customs_processes';
const FOLDERS_COLLECTION = 'process_document_folders';
const DOCUMENTS_COLLECTION = 'process_documents';
const DRAFT_FORM_FIELD = '_processDocumentsDraftToken';

interface NocoBaseModel {
  isNewRecord?: boolean;
  get(key: string): unknown;
}

interface HookOptions {
  transaction?: TransactionContext & {
    afterCommit?(callback: () => void | Promise<void>): void;
  };
  context?: {
    state?: {
      currentRoles?: unknown[];
      currentUser?: { id?: unknown };
      currentUserId?: unknown;
      user?: { id?: unknown };
    };
    request?: { body?: unknown };
    action?: { params?: { values?: unknown; [key: string]: unknown } };
  };
}

export class ProcessDocumentsHooks {
  constructor(
    private readonly plugin: Plugin,
    private readonly repository: ProcessDocumentsRepository,
    private readonly storage: DocumentStorage,
    private readonly attachDraftDocuments: AttachDraftDocumentsToProcess,
    private readonly validateFolderPlacement: ValidateDocumentFolderPlacement,
    private readonly validateDocumentPlacement: ValidateProcessDocumentPlacement,
    private readonly logger: ApplicationLogger,
  ) {}

  register(): void {
    this.plugin.db.on(
      `${PROCESS_COLLECTION}.afterCreateWithAssociations`,
      async (model: NocoBaseModel, options: HookOptions) => {
        await this.attachDraftDocuments.execute({
          draftToken: this.draftTokenFromOptions(options),
          processId: parseIdentifier(model.get('id')),
          actorId: this.actorIdFromOptions(options),
          isRoot: this.isRootFromOptions(options),
          transaction: options.transaction,
        });
      },
    );

    this.plugin.db.on(`${FOLDERS_COLLECTION}.beforeSave`, async (model: NocoBaseModel, options: HookOptions) => {
      const previous = await this.previousFolder(model, options.transaction);
      const scope = this.scopeFromModel(model, previous?.processId ?? null, previous?.draftToken ?? null);
      await this.validateFolderPlacement.execute({
        folderId: parseIdentifier(model.get('id')),
        parentFolderId:
          parseIdentifier(model.get('parent_folder_id') ?? model.get('parent_folder')) ??
          previous?.parentFolderId ??
          null,
        scope,
        transaction: options.transaction,
      });
    });

    this.plugin.db.on(`${DOCUMENTS_COLLECTION}.beforeSave`, async (model: NocoBaseModel, options: HookOptions) => {
      const previous = await this.previousDocument(model, options.transaction);
      const scope = this.scopeFromModel(model, previous?.processId ?? null, previous?.draftToken ?? null);
      await this.validateDocumentPlacement.execute({
        folderId: parseIdentifier(model.get('folder_id') ?? model.get('folder')) ?? previous?.folderId ?? null,
        scope,
        transaction: options.transaction,
      });
    });

    this.plugin.db.on(`${DOCUMENTS_COLLECTION}.afterDestroy`, async (model: NocoBaseModel, options: HookOptions) => {
      const storageKey = parseIdentifier(model.get('storage_key'));
      if (!storageKey) {
        return;
      }
      const removeStorageObject = async () => {
        try {
          const deleted = await this.storage.delete(storageKey);
          if (!deleted) {
            this.logger.warn('Объект удалённого документа уже отсутствовал в хранилище', { storageKey });
          }
        } catch (error) {
          this.logger.error('После удаления документа остался объект в хранилище', error, { storageKey });
        }
      };
      if (options.transaction?.afterCommit) {
        options.transaction.afterCommit(removeStorageObject);
        return;
      }
      await removeStorageObject();
    });
  }

  private async previousFolder(model: NocoBaseModel, transaction?: TransactionContext) {
    const id = parseIdentifier(model.get('id'));
    return !model.isNewRecord && id ? this.repository.findFolderById(id, transaction) : null;
  }

  private async previousDocument(model: NocoBaseModel, transaction?: TransactionContext) {
    const id = parseIdentifier(model.get('id'));
    return !model.isNewRecord && id ? this.repository.findDocumentById(id, transaction) : null;
  }

  private scopeFromModel(
    model: NocoBaseModel,
    previousProcessId: string | null,
    previousDraftToken: string | null,
  ): DocumentScope {
    const processId = parseIdentifier(model.get('process_id') ?? model.get('process')) ?? previousProcessId;
    if (processId) {
      return { mode: 'process', processId };
    }
    const draftToken = parseDraftToken(model.get('draft_token')) ?? previousDraftToken;
    if (!draftToken) {
      throw new ProcessDocumentsError(
        'PROCESS_REQUIRED',
        'Нельзя создать документ без таможенного процесса или черновика процесса.',
      );
    }
    return { mode: 'draft', draftToken };
  }

  private draftTokenFromOptions(options: HookOptions): string | null {
    const requestBody = this.asRecord(options.context?.request?.body);
    const actionValues = this.asRecord(options.context?.action?.params?.values);
    const actionParams = this.asRecord(options.context?.action?.params);
    return parseDraftToken(
      actionValues.draftToken ??
        actionValues.draft_token ??
        actionValues[DRAFT_FORM_FIELD] ??
        actionParams.draftToken ??
        actionParams.draft_token ??
        actionParams[DRAFT_FORM_FIELD] ??
        requestBody.draftToken ??
        requestBody.draft_token ??
        requestBody[DRAFT_FORM_FIELD],
    );
  }

  private actorIdFromOptions(options: HookOptions): string | null {
    return parseIdentifier(
      options.context?.state?.currentUser?.id ??
        options.context?.state?.currentUserId ??
        options.context?.state?.user?.id,
    );
  }

  private isRootFromOptions(options: HookOptions): boolean {
    return (options.context?.state?.currentRoles || []).map(String).includes('root');
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
