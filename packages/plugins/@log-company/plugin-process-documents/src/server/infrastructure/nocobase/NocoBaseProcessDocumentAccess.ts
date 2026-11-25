/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createUserProvider, parseJsonTemplate } from '@nocobase/acl';
import type { Context } from '@nocobase/actions';
import type { Plugin } from '@nocobase/server';
import type { BelongsToManyRepository, Filter, Model, Transaction } from '@nocobase/database';
import { contractAreaId, documentRecordId, documentSections } from '../../../contracts/processDocuments';
import type { DocumentSection, SectionPermissions } from '../../../contracts/processDocuments';
import type { DocumentSectionAccess } from '../../application/DocumentSectionAccess';
import type { CompanyDocumentScope, DocumentScope } from '../../domain/documents/DocumentScope';
import { ProcessDocumentsError } from '../../domain/documents/DocumentErrors';
import type { ProcessDocumentAccess, ProcessDocumentOperation } from '../../application/ports/ProcessDocumentAccess';
import type { DocumentActor, TransactionContext } from '../../application/ports/ProcessDocumentsRepository';

const SHIPMENTS_COLLECTION = 'shipments';

interface PermissionResult {
  params?: {
    filter?: Filter;
    whitelist?: string[];
    blacklist?: string[];
  };
}

interface NocoBaseAuthorizationContext extends Context {
  can?: (input: { resource: string; action: string }) => PermissionResult | null;
}

export class NocoBaseProcessDocumentAccess implements ProcessDocumentAccess {
  constructor(
    private readonly plugin: Plugin,
    private readonly sectionAccess?: DocumentSectionAccess,
  ) {}

  async assertAccess(
    shipmentId: string,
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
    transaction?: TransactionContext,
  ): Promise<void> {
    if (!(await this.canAccess(SHIPMENTS_COLLECTION, shipmentId, this.actionFor(operation), actor, transaction))) {
      throw new ProcessDocumentsError('SHIPMENT_ACCESS_DENIED', 'Нет прав для действия с документами поставки.');
    }
    if (this.sectionAccess && !actor.isRoot) {
      const shipment = await this.plugin.db.getRepository(SHIPMENTS_COLLECTION).findOne({
        filterByTk: shipmentId,
        fields: ['company_id'],
        transaction: transaction as Transaction | undefined,
      });
      await this.sectionAccess.assert('ved', this.companyKey(shipment?.get('company_id')), operation, actor);
    }
  }

  async documentCompanies(scope: Extract<DocumentScope, { mode: 'shipment' | 'run' }>): Promise<Array<string | null>> {
    if (scope.mode === 'shipment') {
      const shipment = await this.plugin.db.getRepository(SHIPMENTS_COLLECTION).findOne({
        filterByTk: scope.shipmentId,
        fields: ['company_id'],
      });
      return [this.companyKey(shipment?.get('company_id'))];
    }
    const run = await this.plugin.db.getRepository('transport_runs').findOne({
      filterByTk: scope.runId,
      appends: ['shipments.company_id'],
    });
    const companies = this.runCompanies(run?.get('shipments'));
    return companies.size ? [...companies] : [null];
  }

  async assertCompanyAccess(
    scope: CompanyDocumentScope,
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
    transaction?: TransactionContext,
  ) {
    if (scope.companyArea === 'permits' && operation !== 'read') {
      throw new ProcessDocumentsError(
        'DOCUMENT_ACCESS_DENIED',
        'Раздел разрешительных документов доступен для просмотра.',
      );
    }
    await this.assertCompanyRecord(scope.companyId, operation, actor, transaction);
    const contract = contractAreaId(scope.companyArea);
    if (contract) {
      const companies = await this.contractCompanies(contract, transaction);
      if (
        !companies.includes(scope.companyId) ||
        !(await this.canAccess('contracts', contract, operation === 'read' ? 'get' : 'update', actor, transaction))
      ) {
        throw new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'Нет доступа к документам этого контракта.');
      }
      await this.sectionAccess?.assert('contracts', scope.companyId, operation, actor);
      return;
    }
    const section =
      scope.companyArea === 'company' || scope.companyArea === 'permits' ? scope.companyArea : 'corporate';
    await this.sectionAccess?.assert(section, scope.companyId, operation, actor);
  }

  async sectionPermissions(companyId: string | null, actor: DocumentActor): Promise<SectionPermissions> {
    if (companyId) await this.assertCompanyRecord(companyId, 'read', actor);
    const sections = await Promise.all(
      documentSections.map(
        async (section) =>
          [section, (await this.sectionAccess?.allows(section, companyId, 'read', actor)) ?? true] as const,
      ),
    );
    return { sections: Object.fromEntries(sections) as SectionPermissions['sections'], canManageAccess: actor.isRoot };
  }

  async allowsCompanyFolderSection(
    section: 'requests' | 'corporate',
    companyId: string,
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
  ) {
    return (await this.sectionAccess?.allows(section, companyId, operation, actor)) ?? true;
  }

  async assertDraftAccess(operation: ProcessDocumentOperation, actor: DocumentActor, companyId: string | null = null) {
    // В своём черновике можно убрать файл и без права удаления сохранённых документов.
    if (companyId) await this.assertCompanyRecord(companyId, 'read', actor);
    await this.sectionAccess?.assert('ved', companyId, operation, actor, {});
  }

  async assertCompanyRecord(
    companyId: string,
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
    transaction?: TransactionContext,
  ) {
    const companyAction = operation === 'read' ? 'get' : 'update';
    const company = await this.plugin.db
      .getRepository('our_companies')
      .findOne({ filter: { id: companyId }, transaction: transaction as Transaction | undefined });
    if (!company) throw new ProcessDocumentsError('OWNER_NOT_FOUND', 'Компания не найдена.');
    if (!(await this.canAccess('our_companies', companyId, companyAction, actor, transaction))) {
      throw new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'Нет доступа к документам компании.');
    }
  }

  async assertRunAccess(
    runId: string,
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
    companyId: string | null,
    transaction?: TransactionContext,
  ) {
    if (companyId) await this.assertCompanyRecord(companyId, 'read', actor, transaction);
    const run = await this.plugin.db.getRepository('transport_runs').findOne({
      filter: { id: runId, ...(companyId && { 'shipments.company_id': companyId }) },
      ...(this.sectionAccess && !actor.isRoot && { appends: ['shipments.company_id'] }),
      transaction: transaction as Transaction | undefined,
    });
    if (!run) {
      throw new ProcessDocumentsError(
        'OWNER_NOT_FOUND',
        companyId ? 'Рейс не относится к этой компании.' : 'Рейс не найден.',
      );
    }
    const runAction = this.actionFor(operation);
    if (!(await this.canAccess('transport_runs', runId, runAction, actor, transaction))) {
      throw new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'Нет доступа к документам рейса.');
    }
    if (this.sectionAccess && !actor.isRoot) {
      if (operation === 'read' && companyId) {
        await this.sectionAccess.assert('ved', companyId, operation, actor);
        return;
      }
      const companies = this.runCompanies(run.get('shipments'));
      if (!companies.size) companies.add(companyId);
      if (operation === 'read') {
        for (const company of companies) {
          if (await this.sectionAccess.allows('ved', company, operation, actor)) return;
        }
        throw new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'Нет доступа к документам рейса.');
      }
      for (const company of companies) await this.sectionAccess.assert('ved', company, operation, actor);
    }
  }

  async assertAttachmentSection(
    section: 'corporate' | 'permits' | 'contracts',
    id: string,
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
    transaction?: TransactionContext,
  ) {
    if (actor.isRoot || !this.sectionAccess) return;
    if (section === 'contracts') {
      const companies = await this.contractCompanies(id, transaction);
      for (const company of companies.length ? companies : [null]) {
        await this.sectionAccess.assert(section, company, operation, actor);
      }
      return;
    }
    await this.sectionAccess.assert(section, await this.attachmentCompany(section, id, transaction), operation, actor);
  }

  async assertPermitUpload(id: string, actor: DocumentActor, transaction: TransactionContext) {
    if (!(await this.canAccess('permit_documents', id, 'update', actor, transaction, 'documents'))) {
      throw new ProcessDocumentsError(
        'DOCUMENT_ACCESS_DENIED',
        'Нет права добавлять вложения к разрешительному документу.',
      );
    }
    await this.assertAttachmentSection('permits', id, 'write', actor, transaction);
  }

  async assertContractUpload(id: string, actor: DocumentActor, transaction: TransactionContext) {
    if (!(await this.canAccess('contracts', id, 'update', actor, transaction, 'documents'))) {
      throw new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'Нет права добавлять основной документ контракта.');
    }
    await this.assertAttachmentSection('contracts', id, 'write', actor, transaction);
  }

  async attachmentPermissions(section: 'corporate' | 'permits' | 'contracts', id: string, actor: DocumentActor) {
    const resource =
      section === 'corporate' ? 'our_companies' : section === 'contracts' ? 'contracts' : 'permit_documents';
    if (!(await this.canAccess(resource, id, 'get', actor))) {
      throw new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'Нет доступа к документам этой записи.');
    }
    const companies =
      section === 'contracts' ? await this.contractCompanies(id) : [await this.attachmentCompany(section, id)];
    const can = async (operation: ProcessDocumentOperation) =>
      (
        await Promise.all(
          (companies.length ? companies : [null]).map(
            (company) => this.sectionAccess?.allows(section, company, operation, actor) ?? true,
          ),
        )
      ).every(Boolean);
    const [canRead, canWrite, canDelete] = await Promise.all([can('read'), can('write'), can('delete')]);
    return { canRead, canWrite, canDelete };
  }

  private async contractCompanies(id: string, transaction?: TransactionContext): Promise<string[]> {
    const relation = this.plugin.db.getRepository<BelongsToManyRepository>('contracts.importers', id);
    const companies: Model[] = await relation.find({
      fields: ['id'],
      transaction: transaction as Transaction | undefined,
    });
    return companies.flatMap((company) => {
      const companyId = documentRecordId(company.get('id'));
      return companyId ? [companyId] : [];
    });
  }

  private async attachmentCompany(section: 'corporate' | 'permits', id: string, transaction?: TransactionContext) {
    if (section === 'corporate') return id;
    const record = await this.plugin.db.getRepository('permit_documents').findOne({
      filterByTk: id,
      fields: ['company_id'],
      transaction: transaction as Transaction | undefined,
    });
    if (!record) throw new ProcessDocumentsError('OWNER_NOT_FOUND', 'Разрешительный документ не найден.');
    return this.companyKey(record.get('company_id'));
  }

  private runCompanies(shipments: unknown) {
    return new Set(
      (Array.isArray(shipments) ? shipments : []).map((shipment: unknown) =>
        this.companyKey(
          shipment && typeof shipment === 'object' && 'company_id' in shipment ? shipment.company_id : null,
        ),
      ),
    );
  }

  private companyKey(value: unknown): string | null {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
  }
  private async canAccess(
    resource: string,
    id: string,
    action: string,
    actor: DocumentActor,
    transaction?: TransactionContext,
    field?: string,
  ): Promise<boolean> {
    const filter = await this.permissionFilter(resource, action, actor, field, id);
    if (filter === null) return false;
    if (!Object.keys(filter).length) return true;
    return !!(await this.plugin.db
      .getRepository(resource)
      .findOne({ filter: { $and: [{ id }, filter] }, transaction: transaction as Transaction | undefined }));
  }

  async permissionFilter(
    resource: string,
    action: string,
    actor: DocumentActor,
    field?: string,
    id?: string,
  ): Promise<Filter | null> {
    if (actor.isRoot) return {};
    const context = actor.authorizationContext as NocoBaseAuthorizationContext;
    const creating =
      action === 'update' &&
      id !== undefined &&
      actor.creatingOwner?.resource === resource &&
      actor.creatingOwner.recordId === id;
    const permission = context.can?.({ resource, action: creating ? 'create' : action });
    if (!permission) return null;
    const { whitelist, blacklist } = permission.params ?? {};
    if (field && ((whitelist && !whitelist.includes(field)) || blacklist?.includes(field))) return null;
    const rawFilter = permission.params?.filter;
    if (!rawFilter) return {};

    return (
      (await parseJsonTemplate(rawFilter, {
        state: context.state,
        timezone: context.get('x-timezone'),
        userProvider: createUserProvider({
          db: context.db || this.plugin.db,
          currentUser: context.state?.currentUser,
        }),
      })) ?? rawFilter
    );
  }

  private actionFor(operation: ProcessDocumentOperation): 'get' | 'update' {
    // Удаление файла требует просмотра записи, а право удаления берётся из правил документов.
    return operation === 'read' || operation === 'delete' ? 'get' : 'update';
  }
}
