/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  companyRequestFolderTitle,
  companyRequestFolderTypes,
  isCompanyRequestFolder,
  supportsFormFolderUploads,
  type DocumentFormResource,
} from '../../contracts/processDocuments';
import { ProcessDocumentsError } from '../domain/documents/DocumentErrors';
import type { DocumentFolderService } from './DocumentFolderService';
import type { DocumentActor, ProcessDocumentsRepository, TransactionContext } from './ports/ProcessDocumentsRepository';
import type {
  UploadedDocumentFile,
  UploadProcessDocuments,
  UploadProcessDocumentsInput,
} from './UploadProcessDocuments';

export interface FormDocumentsPublication {
  resource: DocumentFormResource;
  recordId: string;
  actor: DocumentActor;
  files: UploadedDocumentFile[];
  folderId?: string;
  emptyFolders?: string[];
}

export interface FormDocumentsTransaction {
  transaction: TransactionContext;
  onRollback(cleanup: () => Promise<void>): void;
}

export interface FormDocumentOwners {
  contractImporterIds(id: string, transaction: TransactionContext): Promise<string[]>;
  lockCompany(id: string, transaction: TransactionContext): Promise<void>;
  publishPermit(input: FormDocumentsPublication, outer: FormDocumentsTransaction): Promise<void>;
  publishContract(input: FormDocumentsPublication, outer: FormDocumentsTransaction): Promise<void>;
}

export class PublishFormDocuments {
  constructor(
    private readonly owners: FormDocumentOwners,
    private readonly repository: ProcessDocumentsRepository,
    private readonly folders: DocumentFolderService,
    private readonly upload: UploadProcessDocuments,
  ) {}

  async execute(input: FormDocumentsPublication, outer: FormDocumentsTransaction): Promise<void> {
    const { actor, files, recordId, resource } = input;
    const { transaction } = outer;
    if ((input.folderId || input.emptyFolders?.length) && !supportsFormFolderUploads(resource)) {
      throw new ProcessDocumentsError(
        'INVALID_DOCUMENT_SCOPE',
        'Эта форма не поддерживает загрузку в выбранную папку.',
      );
    }
    const destination: UploadProcessDocumentsInput = {
      actor,
      files,
      folderId: input.folderId ?? null,
      ...(input.emptyFolders?.length && { emptyFolders: input.emptyFolders }),
      shipmentId: null,
      draftToken: null,
    };
    switch (resource) {
      case 'permit_documents':
        await this.owners.publishPermit(input, outer);
        return;
      case 'transport_runs':
        destination.runId = recordId;
        break;
      case 'shipments':
        destination.shipmentId = recordId;
        break;
      case 'contracts': {
        const companies = await this.owners.contractImporterIds(recordId, transaction);
        if (companies.length !== 1) {
          throw new ProcessDocumentsError(
            'INVALID_DOCUMENT_SCOPE',
            'Для загрузки основного документа у контракта должна быть указана одна компания.',
          );
        }
        await this.owners.publishContract(input, outer);
        return;
      }
      case 'our_companies': {
        const companyId = recordId;
        destination.companyId = companyId;
        destination.companyArea = 'company';
        const scope = await this.upload.assertDestination(destination, transaction);
        // Serialize first uploads that would otherwise both create the shared folder.
        await this.owners.lockCompany(companyId, transaction);
        const matches = (await this.repository.listFolders(scope, null, transaction)).filter(({ title }) =>
          isCompanyRequestFolder(title),
        );
        if (matches.length > 1) {
          throw new ProcessDocumentsError('FORM_DRAFT_BUSY', 'У компании найдено несколько папок «По запросу».');
        }
        const requestFolder =
          matches[0] ?? (await this.folders.create(scope, companyRequestFolderTitle, null, actor, transaction));
        await this.upload.assertDestination({ ...destination, folderId: requestFolder.id }, transaction);
        const type = companyRequestFolderTypes[resource];
        const typedFolders = (await this.repository.listFolders(scope, requestFolder.id, transaction)).filter(
          ({ title }) => title === type,
        );
        if (typedFolders.length > 1) {
          throw new ProcessDocumentsError('FORM_DRAFT_BUSY', `У компании найдено несколько папок «${type}».`);
        }
        destination.folderId = (
          typedFolders[0] ?? (await this.folders.create(scope, type, requestFolder.id, actor, transaction))
        ).id;
        break;
      }
    }
    await this.upload.execute(destination, outer);
  }
}
