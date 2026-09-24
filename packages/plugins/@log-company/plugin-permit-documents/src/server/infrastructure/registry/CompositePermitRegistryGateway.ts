/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { TechnicalRegulationCandidate } from '../../application/ports/PermitDocumentRepository';
import type { PermitRegistryGateway } from '../../application/ports/PermitRegistryGateway';
import type { PermitDocumentType } from '../../domain/permit-document/PermitDocumentPolicy';
import type { RegistryDocument, RegistryDocumentStatus } from '../../domain/permit-document/RegistryDocument';
import { EaeuPermitRegistryClient } from './EaeuPermitRegistryClient';
import { FsaPermitRegistryClient } from './FsaPermitRegistryClient';
import { SwisPermitRegistryClient } from './SwisPermitRegistryClient';
import type { SwisPermitDocumentType } from './SwisResponseParser';

export class CompositePermitRegistryGateway implements PermitRegistryGateway {
  constructor(
    private readonly fsa: FsaPermitRegistryClient,
    private readonly eaeu: EaeuPermitRegistryClient,
    private readonly swis: SwisPermitRegistryClient,
  ) {}

  findByTitle(documentType: PermitDocumentType, title: string): Promise<RegistryDocument | null> {
    if (documentType === 'state_registration_certificate') {
      return this.eaeu.findByTitle(title);
    }
    return this.isSwisDocument(documentType, title)
      ? this.swis.findByTitle(documentType, title)
      : this.fsa.findByTitle(documentType, title);
  }

  findStatusByTitle(documentType: PermitDocumentType, title: string): Promise<RegistryDocumentStatus | null> {
    if (documentType === 'state_registration_certificate') {
      return this.eaeu.findStatusByTitle(title);
    }
    return this.isSwisDocument(documentType, title)
      ? this.swis.findStatusByTitle(documentType, title)
      : this.fsa.findStatusByTitle(documentType, title);
  }

  getByExternalId(
    documentType: PermitDocumentType,
    externalId: string,
    title: string,
  ): Promise<RegistryDocument | null> {
    if (documentType === 'state_registration_certificate') {
      return this.eaeu.getByExternalId(externalId);
    }
    return this.isSwisDocument(documentType, title)
      ? this.swis.getByExternalId(documentType, externalId, title)
      : this.fsa.getByExternalId(documentType, externalId);
  }

  getFsaTechnicalRegulations(fsaIds: readonly number[]): Promise<TechnicalRegulationCandidate[]> {
    return this.fsa.getTechnicalRegulations(fsaIds);
  }

  private isSwisDocument(documentType: PermitDocumentType, title: string): documentType is SwisPermitDocumentType {
    if (documentType === 'state_registration_certificate') {
      return false;
    }
    return /(?:^|[\s./-])KG(?=\s*\d|[\s./-]|$)/iu.test(title);
  }
}
