/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { EaeuResponseParser } from '../EaeuResponseParser';
import { FsaResponseParser } from '../FsaResponseParser';

describe('registry response parsers', () => {
  it('uses exact title matching for FSA search and normalizes certificate dates', () => {
    const parser = new FsaResponseParser();
    expect(
      parser.findExactSearchId(
        {
          items: [
            { id: 1, number: 'DOC-10' },
            { id: 2, number: 'DOC-1' },
          ],
        },
        'DOC-1',
      ),
    ).toBe('2');
    expect(
      parser.parseCard('certificate_of_conformity', {
        idCertificate: 2,
        idStatus: 15,
        number: 'DOC-1',
        certRegDate: '2026-08-26',
        certEndDate: '25.08.2031',
        idTechnicalReglaments: [17],
        product: { fullName: 'Игрушки' },
      }),
    ).toMatchObject({
      externalId: '2',
      status: 'suspended',
      validUntil: '2031-08-25',
      technicalRegulations: [{ source: 'FSA', fsaId: 17 }],
    });
  });

  it('reads an SGR card, ignores dateTo and parses DOC_GIGHARK', () => {
    const parser = new EaeuResponseParser();
    const response = {
      id: 'e5f0f541-e991-4c91-8ad2-81c4ce3fbbc2',
      dateTo: '2100-01-01',
      data: {
        NUMB_DOC: 'BY.1',
        DATE_DOC: '2026-08-27',
        NAME_PROD: 'Блеск для губ',
        STATUS: { name: 'подписан и действует' },
        DOC_GIGHARK: [
          { sourceData: { DOC_GIGHARK_NAME: 'Техническому регламенту ТР ТС 009/2011 — О безопасности продукции' } },
        ],
      },
    };
    expect(parser.parseCard(response)).toMatchObject({
      documentName: 'BY.1',
      validUntil: null,
      status: 'valid',
      technicalRegulations: [{ source: 'EAEU', docNum: 'ТР ТС 009/2011', name: 'О безопасности продукции' }],
    });
  });

  it('turns an unknown registry status into a parsing error', () => {
    expect(() =>
      new EaeuResponseParser().parseCard({
        id: 'uuid',
        data: { NUMB_DOC: 'DOC', DATE_DOC: '2026-01-01', NAME_PROD: 'Product', STATUS: { name: 'draft' } },
      }),
    ).toThrow('unsupported document status');
  });
});
