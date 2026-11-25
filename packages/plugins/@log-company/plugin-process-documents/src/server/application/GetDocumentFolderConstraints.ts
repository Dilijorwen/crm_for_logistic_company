/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  companyRequestFolderTypes,
  contractAreaId,
  isCompanyRequestFolder,
  type DocumentSection,
  type FolderAccessConstraint,
} from '../../contracts/processDocuments';
import type { DocumentScope } from '../domain/documents/DocumentScope';
import type { DocumentScopeService } from './DocumentScopeService';
import type { DocumentSectionAccess } from './DocumentSectionAccess';
import type { DocumentActor } from './ports/ProcessDocumentsRepository';

type CustomsScope = Extract<DocumentScope, { mode: 'shipment' | 'run' }>;

const titles: Record<DocumentSection, string> = {
  ved: 'ВЭД',
  company: 'Компания',
  corporate: 'Учредительные документы',
  permits: 'Разрешительные документы',
  contracts: 'Контракты',
  requests: 'По запросу',
};

export class GetDocumentFolderConstraints {
  constructor(
    private readonly scopes: DocumentScopeService,
    private readonly sections: DocumentSectionAccess,
    private readonly documentCompanies: (scope: CustomsScope) => Promise<Array<string | null>>,
  ) {}

  async execute(
    folderId: string,
    companyContext: string | null,
    actor: DocumentActor,
  ): Promise<FolderAccessConstraint[]> {
    const folder = await this.scopes.requireFolderById(folderId);
    if (folder.runId && companyContext) {
      await this.scopes.resolve({
        runId: folder.runId,
        companyId: companyContext,
        shipmentId: null,
        draftToken: null,
        operation: 'read',
        actor,
      });
    }
    const scope = await this.scopes.resolveForFolder(folder, null, 'read', actor);
    const breadcrumbs = await this.scopes.getBreadcrumbs(folderId, scope);
    const ancestors = await Promise.all(breadcrumbs.slice(0, -1).map(({ id }) => this.scopes.requireFolder(id, scope)));
    const constraints: FolderAccessConstraint[] = [];
    if (scope.mode === 'run' || scope.mode === 'shipment') {
      const companies = await this.documentCompanies(scope);
      const policies = await Promise.all(companies.map((id) => this.sections.get('ved', id)));
      const readPolicies =
        scope.mode === 'run' && companyContext ? [await this.sections.get('ved', companyContext)] : policies;
      constraints.push({ type: 'section', section: 'ved', title: titles.ved, policies, readPolicies });
    } else if (scope.mode === 'company') {
      const area = scope.companyArea;
      const sections: DocumentSection[] = [
        contractAreaId(area) ? 'contracts' : area === 'permits' || area === 'company' ? area : 'corporate',
      ];
      if (area === 'company' && breadcrumbs[0] && isCompanyRequestFolder(breadcrumbs[0].title)) {
        sections.push('requests');
        if (breadcrumbs[1]?.title === companyRequestFolderTypes.our_companies) sections.push('corporate');
      }
      for (const section of sections) {
        constraints.push({
          type: 'section',
          section,
          title: titles[section],
          policies: [await this.sections.get(section, scope.companyId)],
        });
      }
    }
    for (const ancestor of ancestors) {
      if (ancestor?.grants) constraints.push({ type: 'folder', title: ancestor.title, grants: ancestor.grants });
    }
    return constraints;
  }
}
