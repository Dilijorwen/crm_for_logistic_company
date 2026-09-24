/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type Identifier = string;

export interface ReferenceRecord {
  id: Identifier;
  label: string;
}

export interface ContractReferenceRecord extends ReferenceRecord {
  companyIds: Identifier[];
}

export interface ShipmentRecord {
  id: Identifier;
  shipmentNumber: number;
  displayName: string;
  chineseClient: ReferenceRecord | null;
  company: ReferenceRecord | null;
  routeDeliveryNumber: string;
  invoiceNumber: string;
  invoiceValue: number | null;
  contract: ReferenceRecord | null;
  customsScheme: string;
  customsWarehouse: ReferenceRecord | null;
  customsWarehouseStorageDate: string | null;
  declarationNumber: string;
  applicationNumber: string;
  documentsInBadis: boolean;
  customsPaymentsAmount: number | null;
  ecoFee: number | null;
  ktcAmount: number | null;
  ntmCertificateGoods: string;
  ntmSkkGoods: string;
  ntmKfkGoods: string;
  ntmHonestSignGoods: string;
  ntmExportDeclarationRequired: boolean;
  ntmHonestSignSum: number | null;
  goodsCount: number | null;
  enteredIn1c: boolean;
  sentToClient: boolean;
  declarationReleaseDate: string | null;
  applicationReleaseDate: string | null;
  additionalCheckResponseDeadline: string | null;
  actualControl: boolean;
  anosovDistributed: boolean;
  managerComment: string;
}

export interface TransportRunRecord {
  id: Identifier;
  runNumber: number;
  status: string;
  createdAt: string;
  registrationNumber: string;
  departureCity: ReferenceRecord | null;
  managers: ReferenceRecord[];
  declarants: ReferenceRecord[];
  parentRuns: ReferenceRecord[];
  shipments: ShipmentRecord[];
}

export interface LogisticsHistoryRecord {
  id: Identifier;
  eventType: string;
  fieldName: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
  createdAt: string;
  createdBy: string;
}

export interface RunMutationInput {
  registrationNumber: string;
  status: string;
  departureCityId: Identifier | null;
  managerIds: Identifier[];
  declarantIds: Identifier[];
  parentRunIds: Identifier[];
}

export interface ShipmentMutationInput {
  chineseClientId: Identifier;
  companyId: Identifier;
  routeDeliveryNumber?: string;
  invoiceNumber?: string;
  invoiceValue?: number | null;
  contractId?: Identifier | null;
  customsScheme?: string;
  customsWarehouseId?: Identifier | null;
  customsWarehouseStorageDate?: string | null;
  declarationNumber?: string;
  applicationNumber?: string;
  documentsInBadis?: boolean;
  customsPaymentsAmount?: number | null;
  ecoFee?: number | null;
  ktcAmount?: number | null;
  ntmCertificateGoods?: string;
  ntmSkkGoods?: string;
  ntmKfkGoods?: string;
  ntmHonestSignGoods?: string;
  ntmExportDeclarationRequired?: boolean;
  ntmHonestSignSum?: number | null;
  goodsCount?: number | null;
  enteredIn1c?: boolean;
  sentToClient?: boolean;
  declarationReleaseDate?: string | null;
  applicationReleaseDate?: string | null;
  additionalCheckResponseDeadline?: string | null;
  actualControl?: boolean;
  anosovDistributed?: boolean;
  managerComment?: string;
}

export interface LogisticsReferenceData {
  chineseClients: ReferenceRecord[];
  companies: ReferenceRecord[];
  contracts: ContractReferenceRecord[];
  customsWarehouses: ReferenceRecord[];
  departureCities: ReferenceRecord[];
  users: ReferenceRecord[];
}
