/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { SchedulePermitDocumentSync } from '../application/SchedulePermitDocumentSync';
import { SynchronizePermitDocument } from '../application/SynchronizePermitDocument';
import { FetchJsonTransport } from '../infrastructure/http/FetchJsonTransport';
import { NocoBasePermitDocumentRepository } from '../infrastructure/nocobase/NocoBasePermitDocumentRepository';
import { NocoBasePermitDocumentSyncQueue } from '../infrastructure/nocobase/NocoBasePermitDocumentSyncQueue';
import { NocoBaseSyncLogger, SystemSyncClock } from '../infrastructure/nocobase/SystemSyncSupport';
import { CompositePermitRegistryGateway } from '../infrastructure/registry/CompositePermitRegistryGateway';
import { EaeuPermitRegistryClient, IntlMoscowDateProvider } from '../infrastructure/registry/EaeuPermitRegistryClient';
import { EaeuResponseParser } from '../infrastructure/registry/EaeuResponseParser';
import { FsaAuthTokenProvider } from '../infrastructure/registry/FsaAuthTokenProvider';
import { FsaPermitRegistryClient } from '../infrastructure/registry/FsaPermitRegistryClient';
import { FsaResponseParser } from '../infrastructure/registry/FsaResponseParser';
import { PermitDocumentValidationHooks } from '../interfaces/hooks/PermitDocumentValidationHooks';
import { PermitDocumentManagedFieldsGuard } from '../interfaces/http/PermitDocumentManagedFieldsGuard';
import { PermitDocumentSubmitSyncMiddleware } from '../interfaces/http/PermitDocumentSubmitSyncMiddleware';
import { PermitDocumentSyncController } from '../interfaces/http/PermitDocumentSyncController';
import { PermitDocumentSyncScheduler } from '../interfaces/scheduling/PermitDocumentSyncScheduler';

const DEFAULT_FSA_BASE_URL = 'https://pub.fsa.gov.ru';
const DEFAULT_EAEU_BASE_URL = 'https://nsi.eaeunion.org';

export class PermitDocumentsModule {
  private scheduler: PermitDocumentSyncScheduler | null = null;

  constructor(private readonly plugin: Plugin) {}

  initialize(): void {
    const repository = new NocoBasePermitDocumentRepository(this.plugin);
    const queue = new NocoBasePermitDocumentSyncQueue(this.plugin);
    const logger = new NocoBaseSyncLogger(this.plugin);
    const clock = new SystemSyncClock();
    const transport = new FetchJsonTransport();
    const fsaBaseUrl = this.urlFromEnvironment('FSA_BASE_URL', DEFAULT_FSA_BASE_URL);
    const eaeuBaseUrl = this.urlFromEnvironment('EAEU_BASE_URL', DEFAULT_EAEU_BASE_URL);
    const tokenProvider = new FsaAuthTokenProvider(
      transport,
      fsaBaseUrl,
      process.env.FSA_USERNAME || '',
      process.env.FSA_PASSWORD || '',
    );
    const fsa = new FsaPermitRegistryClient(transport, tokenProvider, new FsaResponseParser(), fsaBaseUrl);
    const eaeu = new EaeuPermitRegistryClient(
      transport,
      new EaeuResponseParser(),
      new IntlMoscowDateProvider(),
      eaeuBaseUrl,
    );
    const registry = new CompositePermitRegistryGateway(fsa, eaeu);
    const synchronize = new SynchronizePermitDocument(repository, registry, clock, logger);
    const schedule = new SchedulePermitDocumentSync(repository, queue, clock, logger);

    new PermitDocumentValidationHooks(this.plugin, repository).register();
    new PermitDocumentManagedFieldsGuard(this.plugin).register();
    new PermitDocumentSubmitSyncMiddleware(this.plugin, repository, synchronize, logger).register();
    new PermitDocumentSyncController(this.plugin, synchronize).register();
    this.scheduler = new PermitDocumentSyncScheduler(this.plugin, synchronize, schedule, logger);
    this.scheduler.register();
  }

  dispose(): void {
    this.scheduler?.dispose();
    this.scheduler = null;
  }

  private urlFromEnvironment(name: 'FSA_BASE_URL' | 'EAEU_BASE_URL', fallback: string): string {
    const value = process.env[name]?.trim() || fallback;
    return value.replace(/\/$/, '');
  }
}
