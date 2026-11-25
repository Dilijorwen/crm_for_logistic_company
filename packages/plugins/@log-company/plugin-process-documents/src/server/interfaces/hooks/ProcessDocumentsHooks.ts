/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { AttachDraftDocumentsToProcess } from '../../application/AttachDraftDocumentsToProcess';
import { DeleteProcessDocumentsForProcess } from '../../application/DeleteProcessDocumentsForProcess';
import type { DocumentFolderService } from '../../application/DocumentFolderService';
import { ValidateDocumentFolderPlacement } from '../../application/ValidateDocumentFolderPlacement';
import { ValidateProcessDocumentPlacement } from '../../application/ValidateProcessDocumentPlacement';
import type { DocumentStorage } from '../../application/ports/DocumentStorage';
import type {
  ProcessDocumentsRepository,
  TransactionContext,
} from '../../application/ports/ProcessDocumentsRepository';
import { ProcessDocumentsError } from '../../domain/documents/DocumentErrors';
import type { DocumentScope } from '../../domain/documents/DocumentScope';
import { parseDraftToken, parseIdentifier } from '../../domain/documents/DocumentScope';
import { isCompanyDocumentArea } from '../../../contracts/processDocuments';

const SHIPMENTS_COLLECTION = 'shipments';
const FOLDERS_COLLECTION = 'process_document_folders';
const DOCUMENTS_COLLECTION = 'process_documents';
const DRAFT_FORM_FIELD = '_shipmentDocumentsDraftToken';

interface NocoBaseModel {
  isNewRecord?: boolean;
  get(key: string): unknown;
}

interface HookOptions {
  transaction?: TransactionContext;
  context?: {
    state?: {
      currentRoles?: unknown[];
      currentRole?: unknown;
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
    private readonly deleteProcessDocuments: DeleteProcessDocumentsForProcess,
    private readonly validateFolderPlacement: ValidateDocumentFolderPlacement,
    private readonly validateDocumentPlacement: ValidateProcessDocumentPlacement,
    private readonly folderService: DocumentFolderService,
  ) {}

  register(): void {
    // Saving a shipment as an association of a run only emits the model's create event.
    this.plugin.db.on(`${SHIPMENTS_COLLECTION}.afterCreate`, async (model: NocoBaseModel, options: HookOptions) => {
      const shipmentId = parseIdentifier(model.get('id'));
      if (!shipmentId || this.draftTokenFromOptions(options)) return;
      await this.folderService.ensureShipmentDepartmentFolders(
        shipmentId,
        this.actorIdFromOptions(options),
        options.transaction,
      );
    });

    this.plugin.db.on(
      `${SHIPMENTS_COLLECTION}.afterCreateWithAssociations`,
      async (model: NocoBaseModel, options: HookOptions) => {
        const shipmentId = parseIdentifier(model.get('id'));
        const draftToken = this.draftTokenFromOptions(options);
        if (!shipmentId || !draftToken) return;
        const actorId = this.actorIdFromOptions(options);
        const state = options.context?.state;
        await this.attachDraftDocuments.execute({
          draftToken,
          shipmentId,
          actorId,
          isRoot: this.isRootFromOptions(options),
          companyId: parseIdentifier(model.get('company_id')),
          roles:
            state?.currentRole && state.currentRole !== 'union'
              ? [String(state.currentRole)]
              : (state?.currentRoles || []).map(String),
          transaction: options.transaction,
        });
        await this.folderService.ensureShipmentDepartmentFolders(shipmentId, actorId, options.transaction);
      },
    );

    this.plugin.db.on(`${SHIPMENTS_COLLECTION}.afterDestroy`, async (model: NocoBaseModel, options: HookOptions) => {
      const shipmentId = parseIdentifier(model.get('id'));
      if (!shipmentId) {
        return;
      }
      await this.deleteProcessDocuments.execute({ shipmentId, transaction: options.transaction });
    });

    this.plugin.db.on(`${FOLDERS_COLLECTION}.beforeSave`, async (model: NocoBaseModel, options: HookOptions) => {
      const previous = await this.previousFolder(model, options.transaction);
      const scope = this.scopeFromModel(model, previous?.shipmentId ?? null, previous?.draftToken ?? null);
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
      const scope = this.scopeFromModel(model, previous?.shipmentId ?? null, previous?.draftToken ?? null);
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
      await this.storage.enqueueDeletion([storageKey], options.transaction);
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
    previousShipmentId: string | null,
    previousDraftToken: string | null,
  ): DocumentScope {
    const shipmentId = parseIdentifier(model.get('shipment_id') ?? model.get('shipment')) ?? previousShipmentId;
    if (shipmentId) {
      return { mode: 'shipment', shipmentId };
    }
    const companyId = parseIdentifier(model.get('company_id'));
    const runId = parseIdentifier(model.get('transport_run_id'));
    if (runId) return { mode: 'run', runId };
    if (companyId) {
      const companyArea = model.get('company_area');
      return { mode: 'company', companyId, ...(isCompanyDocumentArea(companyArea) && { companyArea }) };
    }
    const draftToken = parseDraftToken(model.get('draft_token')) ?? previousDraftToken;
    if (!draftToken) {
      throw new ProcessDocumentsError(
        'SHIPMENT_REQUIRED',
        'Нельзя создать документ без поставки или черновика поставки.',
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
    return (
      options.context?.state?.currentRole === 'root' ||
      (options.context?.state?.currentRoles || []).map(String).includes('root')
    );
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
