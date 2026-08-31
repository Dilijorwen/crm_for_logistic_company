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
import type { RegistryDocument } from '../../domain/permit-document/RegistryDocument';
import { EaeuPermitRegistryClient } from './EaeuPermitRegistryClient';
import { FsaPermitRegistryClient } from './FsaPermitRegistryClient';

export class CompositePermitRegistryGateway implements PermitRegistryGateway {
  constructor(
    private readonly fsa: FsaPermitRegistryClient,
    private readonly eaeu: EaeuPermitRegistryClient,
  ) {}

  findByTitle(documentType: PermitDocumentType, title: string): Promise<RegistryDocument | null> {
    return documentType === 'state_registration_certificate'
      ? this.eaeu.findByTitle(title)
      : this.fsa.findByTitle(documentType, title);
  }

  getByExternalId(documentType: PermitDocumentType, externalId: string): Promise<RegistryDocument | null> {
    return documentType === 'state_registration_certificate'
      ? this.eaeu.getByExternalId(externalId)
      : this.fsa.getByExternalId(documentType, externalId);
  }

  getFsaTechnicalRegulations(fsaIds: readonly number[]): Promise<TechnicalRegulationCandidate[]> {
    return this.fsa.getTechnicalRegulations(fsaIds);
  }
}
