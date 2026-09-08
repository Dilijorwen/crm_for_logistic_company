/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import {
  companyPermitDocumentsField,
  permitDocumentCompanyField,
} from '../../infrastructure/metadata/permitDocumentAssociationFields';
import permitDocuments from '../permitDocuments';

describe('permit documents collection', () => {
  it('defines the requested business fields and title field', () => {
    expect(permitDocuments).toMatchObject({
      name: 'permit_documents',
      titleField: 'title',
      createdAt: true,
      updatedAt: true,
    });
    expect(permitDocuments.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'title', type: 'string', interface: 'input', allowNull: false }),
        expect.objectContaining({ name: 'document_type', type: 'string', interface: 'select', allowNull: false }),
        expect.objectContaining({ name: 'valid_from', type: 'dateOnly', interface: 'date' }),
        expect.objectContaining({ name: 'valid_until', type: 'dateOnly', interface: 'date' }),
        expect.objectContaining({ name: 'status', type: 'string', interface: 'select' }),
        expect.objectContaining({ name: 'product_information', type: 'text', interface: 'textarea' }),
        expect.objectContaining({ name: 'external_id', type: 'string' }),
        expect.objectContaining({ name: 'sync_status', type: 'string', defaultValue: 'PENDING' }),
        expect.objectContaining({ name: 'last_checked_at', type: 'date' }),
        expect.objectContaining({ name: 'last_sync_error', type: 'text' }),
        expect.objectContaining({ name: 'technical_regulations', type: 'belongsToMany' }),
        expect.objectContaining({ name: 'company_id', type: 'bigInt', allowNull: true }),
      ]),
    );
    expect(permitDocuments.fields).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'technical_regulation' })]),
    );
  });

  it('optionally links each permit document to at most one company and exposes the reverse one-to-many field', () => {
    expect(permitDocumentCompanyField).toMatchObject({
      name: 'company',
      type: 'belongsTo',
      target: 'our_companies',
      foreignKey: 'company_id',
      allowNull: true,
      onDelete: 'RESTRICT',
      uiSchema: { required: false },
    });
    expect(companyPermitDocumentsField).toMatchObject({
      name: 'permit_documents',
      type: 'hasMany',
      target: 'permit_documents',
      foreignKey: 'company_id',
    });
  });

  it('stores multiple attachments through the standard NocoBase attachment collection', () => {
    expect(permitDocuments.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'documents',
          type: 'belongsToMany',
          interface: 'attachment',
          target: 'attachments',
          through: 'permit_document_attachments',
        }),
      ]),
    );
  });
});
