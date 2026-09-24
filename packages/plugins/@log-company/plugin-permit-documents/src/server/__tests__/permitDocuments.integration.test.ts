/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createMockDatabase, type Database, type FieldOptions } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PermitDocumentRepository } from '../application/ports/PermitDocumentRepository';
import documentTechnicalRegulationsDefinition from '../collections/documentTechnicalRegulations';
import permitDocumentsDefinition from '../collections/permitDocuments';
import technicalRegulationsDefinition from '../collections/technicalRegulations';
import {
  companyPermitDocumentsField,
  permitDocumentCompanyField,
} from '../infrastructure/metadata/permitDocumentAssociationFields';
import { PermitDocumentValidationHooks } from '../interfaces/hooks/PermitDocumentValidationHooks';

describe('permit documents persistence', () => {
  let database: Database;

  beforeEach(async () => {
    database = await createMockDatabase();
    await database.clean({ drop: true });
    database.collection({ name: 'users', fields: [{ type: 'string', name: 'nickname' }] });
    database.collection({
      name: 'attachments',
      autoGenId: false,
      fields: [
        { type: 'snowflakeId', name: 'id', primaryKey: true, allowNull: false },
        { type: 'string', name: 'filename' },
      ],
    });
    const companies = database.collection({
      name: 'our_companies',
      autoGenId: false,
      fields: [
        { type: 'snowflakeId', name: 'id', primaryKey: true, allowNull: false },
        { type: 'string', name: 'name', allowNull: false },
      ],
    });
    database.collection(documentTechnicalRegulationsDefinition);
    database.collection(technicalRegulationsDefinition);
    const permitDocuments = database.collection(permitDocumentsDefinition);
    const { name: companyFieldName, ...companyField } = permitDocumentCompanyField;
    const { name: reverseFieldName, ...reverseField } = companyPermitDocumentsField;
    permitDocuments.addField(companyFieldName, companyField as FieldOptions);
    companies.addField(reverseFieldName, reverseField as FieldOptions);
    const repository = {
      clearTechnicalRegulations: async (documentId: string) => {
        await database.getRepository('document_technical_regulations').destroy({ filter: { document_id: documentId } });
      },
    } as unknown as PermitDocumentRepository;
    new PermitDocumentValidationHooks({ db: database } as unknown as Plugin, repository).register();
    await database.sync();
  });

  afterEach(async () => {
    await database.close();
  });

  it('creates PENDING and returns the document through the company one-to-many relation', async () => {
    const company = await database
      .getRepository('our_companies')
      .create({ values: { id: '1001', name: 'Log Company' } });
    const permitDocument = await database.getRepository('permit_documents').create({
      values: {
        id: '2001',
        title: '  ЕАЭС N RU Д-CN.РА07.В.50111/26  ',
        document_type: 'declaration_of_conformity',
        company: company.get('id'),
      },
    });

    expect(permitDocument.get('title')).toBe('ЕАЭС N RU Д-CN.РА07.В.50111/26');
    expect(permitDocument.get('name')).toBe('ЕАЭС N RU Д-CN.РА07.В.50111/26');
    expect(permitDocument.get('sync_status')).toBe('PENDING');
    expect(permitDocument.get('valid_from')).toBeNull();
    const companyDocuments = await database.getRepository('our_companies.permit_documents', company.get('id')).find();
    expect(companyDocuments).toHaveLength(1);
  });

  it('creates a permit document without a company', async () => {
    const permitDocument = await database.getRepository('permit_documents').create({
      values: {
        id: '2006',
        title: 'DOC-WITHOUT-COMPANY',
        document_type: 'certificate_of_conformity',
      },
    });
    const [rows] = (await database.sequelize.query('select company_id from permit_documents where id = :documentId', {
      replacements: { documentId: permitDocument.get('id') },
    })) as unknown as [Array<{ company_id: string | null }>, unknown];

    expect(rows[0].company_id).toBeNull();
    expect(permitDocument.get('sync_status')).toBe('PENDING');
  });

  it('enforces at most one company per document and a global document identity', async () => {
    const first = await database.getRepository('our_companies').create({ values: { id: '1002', name: 'First' } });
    const second = await database.getRepository('our_companies').create({ values: { id: '1003', name: 'Second' } });
    await database.getRepository('permit_documents').create({
      values: { id: '2002', title: 'DOC-1', document_type: 'certificate_of_conformity', company: first.get('id') },
    });
    await expect(
      database.getRepository('permit_documents').create({
        values: { id: '2003', title: 'DOC-1', document_type: 'certificate_of_conformity', company: second.get('id') },
      }),
    ).rejects.toThrow();
  });

  it('rejects an unsupported document type at the repository boundary', async () => {
    const company = await database.getRepository('our_companies').create({ values: { id: '1004', name: 'Third' } });
    await expect(
      database.getRepository('permit_documents').create({
        values: { id: '2004', title: 'DOC-OTHER', document_type: 'other', company: company.get('id') },
      }),
    ).rejects.toThrow('validation.invalidDocumentType');
  });

  it('enforces one join row per document and technical regulation', async () => {
    const company = await database.getRepository('our_companies').create({ values: { id: '1005', name: 'Fourth' } });
    await database.getRepository('permit_documents').create({
      values: { id: '2005', title: 'DOC-TR', document_type: 'declaration_of_conformity', company: company.get('id') },
    });
    await database.getRepository('technical_regulations').create({
      values: { id: '3001', fsa_id: 17, doc_num: 'ТР ТС 008/2011', name: 'О безопасности игрушек' },
    });
    await database.getRepository('document_technical_regulations').create({
      values: { id: '4001', document_id: '2005', technical_regulation_id: '3001' },
    });
    await expect(
      database.getRepository('document_technical_regulations').create({
        values: { id: '4002', document_id: '2005', technical_regulation_id: '3001' },
      }),
    ).rejects.toThrow();
  });
});
