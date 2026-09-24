/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { PermitDocumentValidationError, validatePermitDocument } from '../PermitDocumentPolicy';

function successfulInput() {
  return {
    documentType: 'declaration_of_conformity',
    status: 'valid',
    syncStatus: 'SUCCESS',
    validFrom: '2026-08-01',
    validUntil: '2027-08-01',
    productInformation: 'Оборудование холодильное',
  };
}

describe('validatePermitDocument', () => {
  it('accepts pending, not-found and error records with empty registry fields', () => {
    for (const syncStatus of ['PENDING', 'NOT_FOUND', 'ERROR']) {
      expect(() =>
        validatePermitDocument({
          ...successfulInput(),
          syncStatus,
          status: null,
          validFrom: null,
          validUntil: null,
          productInformation: null,
        }),
      ).not.toThrow();
    }
  });

  it('accepts all final business statuses and open-ended registry documents', () => {
    for (const status of ['valid', 'suspended', 'terminated']) {
      expect(() => validatePermitDocument({ ...successfulInput(), status })).not.toThrow();
    }
    expect(() =>
      validatePermitDocument({
        ...successfulInput(),
        documentType: 'state_registration_certificate',
        validUntil: null,
      }),
    ).not.toThrow();
    expect(() => validatePermitDocument({ ...successfulInput(), validUntil: null })).not.toThrow();
  });

  it('requires a registration date and product information after a successful sync', () => {
    expect(() => validatePermitDocument({ ...successfulInput(), productInformation: null })).toThrowError(
      expect.objectContaining<Partial<PermitDocumentValidationError>>({ code: 'MISSING_SUCCESS_FIELD' }),
    );
    expect(() => validatePermitDocument({ ...successfulInput(), validFrom: null })).toThrowError(
      expect.objectContaining<Partial<PermitDocumentValidationError>>({ code: 'MISSING_SUCCESS_FIELD' }),
    );
  });

  it('rejects an end date for a successfully synchronized SGR', () => {
    expect(() =>
      validatePermitDocument({ ...successfulInput(), documentType: 'state_registration_certificate' }),
    ).toThrowError(expect.objectContaining<Partial<PermitDocumentValidationError>>({ code: 'UNEXPECTED_VALID_UNTIL' }));
  });

  it('rejects unsupported values and invalid dates', () => {
    expect(() => validatePermitDocument({ ...successfulInput(), documentType: 'other' })).toThrowError(
      expect.objectContaining<Partial<PermitDocumentValidationError>>({ code: 'INVALID_DOCUMENT_TYPE' }),
    );
    expect(() => validatePermitDocument({ ...successfulInput(), status: 'revoked' })).toThrowError(
      expect.objectContaining<Partial<PermitDocumentValidationError>>({ code: 'INVALID_STATUS' }),
    );
    expect(() => validatePermitDocument({ ...successfulInput(), validFrom: '2026-02-30' })).toThrowError(
      expect.objectContaining<Partial<PermitDocumentValidationError>>({ code: 'MISSING_SUCCESS_FIELD' }),
    );
    expect(() =>
      validatePermitDocument({ ...successfulInput(), validFrom: '2027-08-01', validUntil: '2026-08-01' }),
    ).toThrowError(expect.objectContaining<Partial<PermitDocumentValidationError>>({ code: 'INVALID_DATE_RANGE' }));
  });
});
