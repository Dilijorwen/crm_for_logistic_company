/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  defaultDocumentSectionRights,
  type DocumentAccessRule,
  type DocumentRight,
  type DocumentRights,
  type DocumentSection,
} from '../../contracts/processDocuments';
import { allowsSectionOperation } from '../domain/documents/DocumentAccessRules';
import { ProcessDocumentsError } from '../domain/documents/DocumentErrors';
import type { DocumentActor } from './ports/ProcessDocumentsRepository';

export interface DocumentSectionRulesRepository {
  read(section: DocumentSection, companyId: string | null): Promise<DocumentAccessRule[]>;
  save(section: DocumentSection, companyId: string | null, rules: DocumentAccessRule[]): Promise<void>;
}

export class DocumentSectionAccess {
  constructor(private readonly rules: DocumentSectionRulesRepository) {}

  async get(section: DocumentSection, companyId: string | null) {
    const [rules, inherited] = await Promise.all([
      this.rules.read(section, companyId),
      companyId ? this.rules.read(section, null) : [],
    ]);
    return { rules, inherited };
  }

  async save(section: DocumentSection, companyId: string | null, rules: DocumentAccessRule[]) {
    await this.rules.save(section, companyId, rules);
  }

  async allows(
    section: DocumentSection,
    companyId: string | null,
    operation: DocumentRight,
    actor: DocumentActor,
    defaults = defaultDocumentSectionRights(section),
  ) {
    if (actor.isRoot) return true;
    const { rules, inherited } = await this.get(section, companyId);
    return allowsSectionOperation(companyId ? inherited : rules, companyId ? rules : [], operation, actor, defaults);
  }

  async assert(
    section: DocumentSection,
    companyId: string | null,
    operation: DocumentRight,
    actor: DocumentActor,
    defaults?: DocumentRights,
  ) {
    if (!(await this.allows(section, companyId, operation, actor, defaults))) {
      const message =
        operation === 'write' && section === 'ved'
          ? 'У вас нет права загружать документы в разделе ВЭД.'
          : 'Нет доступа к документам этого раздела.';
      throw new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', message);
    }
  }
}
