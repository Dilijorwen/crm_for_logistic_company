/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { PermitDocumentType } from '../../domain/permit-document/PermitDocumentPolicy';
import type { RegistryDocument, RegistryDocumentStatus } from '../../domain/permit-document/RegistryDocument';

export interface FsaTechnicalRegulationDto {
  fsaId: number;
  docNum: string;
  name: string | null;
}

export interface PermitRegistryGateway {
  findByTitle(documentType: PermitDocumentType, title: string): Promise<RegistryDocument | null>;
  findStatusByTitle(documentType: PermitDocumentType, title: string): Promise<RegistryDocumentStatus | null>;
  getByExternalId(
    documentType: PermitDocumentType,
    externalId: string,
    title: string,
  ): Promise<RegistryDocument | null>;
  getFsaTechnicalRegulations(fsaIds: readonly number[]): Promise<FsaTechnicalRegulationDto[]>;
}
