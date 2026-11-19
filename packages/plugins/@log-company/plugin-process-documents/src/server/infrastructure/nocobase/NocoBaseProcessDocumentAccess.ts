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
import type { Filter } from '@nocobase/database';
import { documentSections } from '../../../contracts/processDocuments';
import type { DocumentSection, SectionPermissions } from '../../../contracts/processDocuments';
import type { DocumentSectionAccess } from '../../application/DocumentSectionAccess';
import type { CompanyDocumentScope } from '../../domain/documents/DocumentScope';
import { ProcessDocumentsError } from '../../domain/documents/DocumentErrors';
import type { ProcessDocumentAccess, ProcessDocumentOperation } from '../../application/ports/ProcessDocumentAccess';
import type { DocumentActor } from '../../application/ports/ProcessDocumentsRepository';

const SHIPMENTS_COLLECTION = 'shipments';

interface PermissionResult {
  params?: {
    filter?: Filter;
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

  async assertAccess(shipmentId: string, operation: ProcessDocumentOperation, actor: DocumentActor): Promise<void> {
    if (!(await this.canAccess(SHIPMENTS_COLLECTION, shipmentId, this.actionFor(operation), actor))) {
      throw new ProcessDocumentsError('SHIPMENT_ACCESS_DENIED', 'Нет прав для действия с документами поставки.');
    }
    if (this.sectionAccess && !actor.isRoot) {
      const shipment = await this.plugin.db.getRepository(SHIPMENTS_COLLECTION).findOne({
        filterByTk: shipmentId,
        fields: ['company_id'],
      });
      await this.sectionAccess.assert('ved', this.companyKey(shipment?.get('company_id')), operation, actor);
    }
  }

  async assertCompanyAccess(scope: CompanyDocumentScope, operation: ProcessDocumentOperation, actor: DocumentActor) {
    await this.assertCompanyRecord(scope.companyId, operation, actor);
    await this.sectionAccess?.assert(scope.companyArea ?? 'corporate', scope.companyId, operation, actor);
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

  async assertDraftAccess(operation: ProcessDocumentOperation, actor: DocumentActor) {
    await this.sectionAccess?.assert('ved', null, operation, actor);
  }

  async assertCompanyRecord(companyId: string, operation: ProcessDocumentOperation, actor: DocumentActor) {
    const companyAction = operation === 'read' ? 'get' : 'update';
    const company = await this.plugin.db.getRepository('our_companies').findOne({ filter: { id: companyId } });
    if (!company) throw new ProcessDocumentsError('OWNER_NOT_FOUND', 'Компания не найдена.');
    if (!(await this.canAccess('our_companies', companyId, companyAction, actor))) {
      throw new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'Нет доступа к документам компании.');
    }
  }

  async assertRunAccess(
    runId: string,
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
    companyId: string | null,
  ) {
    if (companyId) await this.assertCompanyRecord(companyId, 'read', actor);
    const run = await this.plugin.db.getRepository('transport_runs').findOne({
      filter: { id: runId, ...(companyId && { 'shipments.company_id': companyId }) },
      ...(this.sectionAccess && !actor.isRoot && { appends: ['shipments.company_id'] }),
    });
    if (!run) {
      throw new ProcessDocumentsError(
        'OWNER_NOT_FOUND',
        companyId ? 'Рейс не относится к этой компании.' : 'Рейс не найден.',
      );
    }
    const runAction = operation === 'read' ? 'get' : 'update';
    if (!(await this.canAccess('transport_runs', runId, runAction, actor))) {
      throw new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'Нет доступа к документам рейса.');
    }
    if (this.sectionAccess && !actor.isRoot) {
      if (operation === 'read' && companyId) {
        await this.sectionAccess.assert('ved', companyId, operation, actor);
        return;
      }
      const shipments: unknown = run.get('shipments');
      const companies = new Set(
        (Array.isArray(shipments) ? shipments : []).map((shipment: unknown) =>
          this.companyKey(
            shipment && typeof shipment === 'object' && 'company_id' in shipment ? shipment.company_id : null,
          ),
        ),
      );
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
    section: Extract<DocumentSection, 'corporate' | 'permits'>,
    id: string,
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
  ) {
    if (actor.isRoot || !this.sectionAccess) return;
    await this.sectionAccess.assert(section, await this.attachmentCompany(section, id), operation, actor);
  }

  async attachmentPermissions(section: 'corporate' | 'permits', id: string, actor: DocumentActor) {
    const resource = section === 'corporate' ? 'our_companies' : 'permit_documents';
    if (!(await this.canAccess(resource, id, 'get', actor))) {
      throw new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'Нет доступа к документам этой записи.');
    }
    const company = await this.attachmentCompany(section, id);
    const can = (operation: ProcessDocumentOperation) =>
      this.sectionAccess?.allows(section, company, operation, actor) ?? true;
    const [canRead, canWrite, canDelete] = await Promise.all([can('read'), can('write'), can('delete')]);
    return { canRead, canWrite, canDelete };
  }

  private async attachmentCompany(section: 'corporate' | 'permits', id: string) {
    if (section === 'corporate') return id;
    const record = await this.plugin.db.getRepository('permit_documents').findOne({
      filterByTk: id,
      fields: ['company_id'],
    });
    if (!record) throw new ProcessDocumentsError('OWNER_NOT_FOUND', 'Разрешительный документ не найден.');
    return this.companyKey(record.get('company_id'));
  }

  private companyKey(value: unknown): string | null {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
  }
  private async canAccess(resource: string, id: string, action: string, actor: DocumentActor): Promise<boolean> {
    if (actor.isRoot) return true;
    const context = actor.authorizationContext as NocoBaseAuthorizationContext;
    const permission = context.can?.({ resource, action });
    if (!permission) return false;
    const rawFilter = permission.params?.filter;
    if (!rawFilter) return true;

    const filter =
      (await parseJsonTemplate(rawFilter, {
        state: context.state,
        timezone: context.get('x-timezone'),
        userProvider: createUserProvider({
          db: context.db || this.plugin.db,
          currentUser: context.state?.currentUser,
        }),
      })) ?? rawFilter;
    return !!(await this.plugin.db.getRepository(resource).findOne({ filter: { $and: [{ id }, filter] } }));
  }

  private actionFor(operation: ProcessDocumentOperation): string {
    if (operation === 'read') {
      return 'get';
    }
    if (operation === 'delete') {
      return 'destroy';
    }
    return 'update';
  }
}
