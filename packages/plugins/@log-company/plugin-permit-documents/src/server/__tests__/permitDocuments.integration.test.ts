/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createMockDatabase, SnowflakeIdField, type Database, type FieldOptions, type Model } from '@nocobase/database';
import actions from '@nocobase/actions';
import { ResourceManager } from '@nocobase/resourcer';
import type { Plugin } from '@nocobase/server';
import type { Transaction } from 'sequelize';
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
import { AssignPermitDocumentNumber } from '../application/AssignPermitDocumentNumber';
import { NocoBasePermitDocumentNumberingRepository } from '../infrastructure/nocobase/NocoBasePermitDocumentNumberingRepository';
import { PermitDocumentNumberingHooks } from '../interfaces/hooks/PermitDocumentNumberingHooks';

describe('permit documents persistence', () => {
  let database: Database;
  let resourcer: ResourceManager;

  beforeEach(async () => {
    database = await createMockDatabase();
    let generatedId = 9000;
    SnowflakeIdField.setApp({ snowflakeIdGenerator: { generate: () => ++generatedId } });
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
    // SQLite's column rebuild flattens composite unique indexes. Apply the production indexes after sync.
    const { indexes, ...definition } = permitDocumentsDefinition;
    const permitDocuments = database.collection(definition);
    const { name: companyFieldName, ...companyField } = permitDocumentCompanyField;
    const { name: reverseFieldName, ...reverseField } = companyPermitDocumentsField;
    permitDocuments.addField(companyFieldName, companyField as FieldOptions);
    companies.addField(reverseFieldName, reverseField as FieldOptions);
    const repository = {
      clearTechnicalRegulations: async (documentId: string, transaction?: Transaction) => {
        await database
          .getRepository('document_technical_regulations')
          .destroy({ filter: { document_id: documentId }, transaction });
      },
    } as unknown as PermitDocumentRepository;
    new PermitDocumentValidationHooks({ db: database } as unknown as Plugin, repository).register();
    resourcer = new ResourceManager();
    resourcer.define({ name: 'permit_documents', actions: { create: actions.create } });
    const plugin = { db: database, app: { resourcer } } as unknown as Plugin;
    const numbering = new NocoBasePermitDocumentNumberingRepository(plugin);
    new PermitDocumentNumberingHooks(
      plugin,
      numbering,
      new AssignPermitDocumentNumber(numbering, { assertCanLink: async () => {} }),
    ).register();
    await database.sync({ force: true });
    for (const index of indexes) {
      await database.sequelize.getQueryInterface().addIndex('permit_documents', index.fields, index);
    }
  });

  afterEach(async () => {
    await database.close();
  });

  it.each(['initial', 'rebound'])(
    'saves Submit with %s ID field hooks, optional company and a mutual related document',
    async (fieldState) => {
      if (fieldState === 'rebound') {
        // Reproduce metadata reloading's hook order without rebuilding Sequelize attributes.
        const idField = database.getCollection('permit_documents').getField('id');
        const generateId: (model: Model) => void = idField.listener;
        database.off('permit_documents.beforeValidate', generateId);
        database.on('permit_documents.beforeValidate', generateId);
      }
      const company = await database
        .getRepository('our_companies')
        .create({ values: { id: '1001', name: 'Компания' } });
      async function submit(values: Record<string, unknown>) {
        const context = {
          db: database,
          request: {
            path: '/api/permit_documents:create',
            method: 'POST',
            querystring: 'updateAssociationValues[]=company',
            body: values,
          },
          body: undefined as unknown,
        };
        await resourcer.middleware({ prefix: '/api' })(context, async () => {});
        const record = context.body as { get(key: string): unknown };
        expect(record.get('id')).toBeTruthy();
        return record;
      }
      const first = await submit({
        title: 'СС-1',
        document_type: 'certificate_of_conformity',
        company: company.toJSON(),
      });
      const second = await submit({ title: 'ДС-2', document_type: 'declaration_of_conformity' });
      const third = await submit({
        title: 'СС-3',
        document_type: 'certificate_of_conformity',
        company: company.toJSON(),
        related_document: { id: first.get('id'), title: 'Не изменять исходный документ' },
      });
      const repository = database.getRepository('permit_documents');
      expect(await repository.count()).toBe(3);
      expect(String(first.get('internal_number'))).toBe('1');
      expect(String(second.get('internal_number'))).toBe('2');
      expect(String(third.get('internal_number'))).toBe('1');
      expect(String(first.get('company_id'))).toBe('1001');
      const reloadedSecond = await repository.findOne({ filterByTk: second.get('id') });
      expect(reloadedSecond.get('company_id')).toBeNull();
      expect(String(third.get('related_document_id'))).toBe(String(first.get('id')));
      const reloadedFirst = await repository.findOne({ filterByTk: first.get('id') });
      expect(String(reloadedFirst.get('related_document_id'))).toBe(String(third.get('id')));
      expect(reloadedFirst.get('title')).toBe('СС-1');
    },
  );

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

  it('numbers all document types together and reuses the smallest deleted number', async () => {
    const repository = database.getRepository('permit_documents');
    const first = await repository.create({
      values: { id: '8001', title: 'FIRST', document_type: 'declaration_of_conformity' },
    });
    const second = await repository.create({
      values: { id: '8002', title: 'SECOND', document_type: 'certificate_of_conformity' },
    });
    const third = await repository.create({
      values: { id: '8003', title: 'THIRD', document_type: 'state_registration_certificate' },
    });
    expect([first, second, third].map((document) => String(document.get('internal_number')))).toEqual(['1', '2', '3']);
    await repository.destroy({ filterByTk: second.get('id') });
    const fourth = await repository.create({
      values: { id: '8004', title: 'FOURTH', document_type: 'declaration_of_conformity' },
    });
    expect(String(fourth.get('internal_number'))).toBe('2');
    expect(String((await repository.findOne({ filterByTk: third.get('id') })).get('internal_number'))).toBe('3');
  });

  it('creates a symmetric pair, rejects a third document and preserves the number when one partner is deleted', async () => {
    const repository = database.getRepository('permit_documents');
    const first = await repository.create({
      values: { id: '8101', title: 'FIRST', document_type: 'certificate_of_conformity' },
    });
    const second = await repository.create({
      values: {
        id: '8102',
        title: 'SECOND',
        document_type: 'declaration_of_conformity',
        related_document: { id: first.get('id') },
      },
    });
    const left = await repository.findOne({ filterByTk: first.get('id'), appends: ['related_document'] });
    const right = await repository.findOne({ filterByTk: second.get('id'), appends: ['related_document'] });
    expect(String(left.get('internal_number'))).toBe('1');
    expect(String(right.get('internal_number'))).toBe('1');
    expect(String(left.get('related_document_id'))).toBe(String(second.get('id')));
    expect(String(right.get('related_document_id'))).toBe(String(first.get('id')));
    expect((left.toJSON() as { related_document: { title: string } }).related_document.title).toBe('SECOND');
    expect((right.toJSON() as { related_document: { title: string } }).related_document.title).toBe('FIRST');
    await expect(
      repository.update({ filterByTk: second.get('id'), values: { related_document: null } }),
    ).rejects.toThrow('только при создании');
    await expect(
      repository.create({
        values: {
          id: '8103',
          title: 'THIRD',
          document_type: 'declaration_of_conformity',
          related_document: first.get('id'),
        },
      }),
    ).rejects.toThrow('уже есть связанный документ');
    expect(await repository.count()).toBe(2);
    await repository.destroy({ filterByTk: first.get('id') });
    const survivor = await repository.findOne({ filterByTk: second.get('id') });
    expect(survivor.get('related_document_id')).toBeNull();
    const next = await repository.create({
      values: { id: '8104', title: 'NEXT', document_type: 'certificate_of_conformity' },
    });
    expect(String(next.get('internal_number'))).toBe('2');
    await repository.destroy({ filterByTk: second.get('id') });
    const reused = await repository.create({
      values: { id: '8105', title: 'REUSED', document_type: 'declaration_of_conformity' },
    });
    expect(String(reused.get('internal_number'))).toBe('1');
  });

  it('rejects link and number changes but allows regular document edits', async () => {
    const repository = database.getRepository('permit_documents');
    const first = await repository.create({
      values: { id: '8201', title: 'FIRST', document_type: 'certificate_of_conformity' },
    });
    const second = await repository.create({
      values: { id: '8202', title: 'SECOND', document_type: 'declaration_of_conformity' },
    });
    await expect(
      repository.update({ filterByTk: first.get('id'), values: { related_document: second.get('id') } }),
    ).rejects.toThrow('только при создании');
    await expect(repository.update({ filterByTk: first.get('id'), values: { internal_number: 99 } })).rejects.toThrow(
      'назначается автоматически',
    );
    await repository.update({ filterByTk: first.get('id'), values: { title: 'FIRST-UPDATED' } });
    expect(String((await repository.findOne({ filterByTk: first.get('id') })).get('internal_number'))).toBe('1');
  });

  it('rejects missing, self and multiple references without consuming a number', async () => {
    const repository = database.getRepository('permit_documents');
    const values = { id: '9001', title: 'FAILED', document_type: 'declaration_of_conformity' };
    await expect(repository.create({ values: { ...values, related_document: '9002' } })).rejects.toThrow('не найден');
    await expect(repository.create({ values: { ...values, related_document: ['9002', '9003'] } })).rejects.toThrow(
      'один существующий',
    );
    await expect(repository.create({ values: { ...values, related_document: '9001' } })).rejects.toThrow();
    const created = await repository.create({ values });
    expect(String(created.get('internal_number'))).toBe('1');
  });

  it('rolls back both ends of a pair when the surrounding transaction fails', async () => {
    const repository = database.getRepository('permit_documents');
    const first = await repository.create({
      values: { id: '8301', title: 'FIRST', document_type: 'certificate_of_conformity' },
    });
    await expect(
      database.sequelize.transaction(async (transaction) => {
        await repository.create({
          values: {
            id: '8302',
            title: 'SECOND',
            document_type: 'declaration_of_conformity',
            related_document: first.get('id'),
          },
          transaction,
        });
        throw new Error('Transaction cancelled');
      }),
    ).rejects.toThrow('Transaction cancelled');
    expect(await repository.count()).toBe(1);
    expect((await repository.findOne({ filterByTk: first.get('id') })).get('related_document_id')).toBeNull();
    const second = await repository.create({
      values: {
        id: '8302',
        title: 'SECOND',
        document_type: 'declaration_of_conformity',
        related_document: first.get('id'),
      },
    });
    expect(String(second.get('internal_number'))).toBe('1');
  });
});
