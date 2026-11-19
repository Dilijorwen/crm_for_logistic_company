/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import type { DocumentAccessRule, DocumentSection } from '../../../contracts/processDocuments';
import type { DocumentSectionRulesRepository } from '../../application/DocumentSectionAccess';
import { documentSectionRulesCollection } from '../../collections/processDocumentSectionRules';

export class NocoBaseDocumentSectionRules implements DocumentSectionRulesRepository {
  constructor(private readonly plugin: Plugin) {}

  async read(section: DocumentSection, companyId: string | null): Promise<DocumentAccessRule[]> {
    const record = await this.plugin.db.getRepository(documentSectionRulesCollection).findOne({
      filterByTk: this.key(section, companyId),
    });
    return record?.get('rules') ?? [];
  }

  async save(section: DocumentSection, companyId: string | null, rules: DocumentAccessRule[]): Promise<void> {
    await this.plugin.db.getCollection(documentSectionRulesCollection).model.upsert({
      id: this.key(section, companyId),
      rules,
    });
  }

  private key(section: DocumentSection, companyId: string | null) {
    return `${section}:${companyId ?? 'all'}`;
  }
}
