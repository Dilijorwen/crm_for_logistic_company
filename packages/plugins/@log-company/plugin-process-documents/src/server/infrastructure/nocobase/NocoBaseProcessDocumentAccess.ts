import { createUserProvider, parseJsonTemplate } from '@nocobase/acl';
import type { Context } from '@nocobase/actions';
import type { Plugin } from '@nocobase/server';
import type { Filter } from '@nocobase/database';
import { ProcessDocumentsError } from '../../domain/documents/DocumentErrors';
import type { ProcessDocumentAccess, ProcessDocumentOperation } from '../../application/ports/ProcessDocumentAccess';
import type { DocumentActor } from '../../application/ports/ProcessDocumentsRepository';

const PROCESS_COLLECTION = 'customs_processes';

interface PermissionResult {
  params?: {
    filter?: Filter;
  };
}

interface NocoBaseAuthorizationContext extends Context {
  can?: (input: { resource: string; action: string }) => PermissionResult | null;
}

export class NocoBaseProcessDocumentAccess implements ProcessDocumentAccess {
  constructor(private readonly plugin: Plugin) {}

  async assertAccess(processId: string, operation: ProcessDocumentOperation, actor: DocumentActor): Promise<void> {
    if (actor.isRoot) {
      return;
    }

    const context = actor.authorizationContext as NocoBaseAuthorizationContext;
    const permission = context.can?.({ resource: PROCESS_COLLECTION, action: this.actionFor(operation) });
    if (!permission) {
      throw new ProcessDocumentsError('PROCESS_ACCESS_DENIED', 'Нет прав для действия с документами процесса.');
    }

    const rawFilter = permission.params?.filter;
    const filter = rawFilter
      ? (await parseJsonTemplate(rawFilter, {
          state: context.state,
          timezone: context.get('x-timezone'),
          userProvider: createUserProvider({
            db: context.db || this.plugin.db,
            currentUser: context.state?.currentUser,
          }),
        })) ?? rawFilter
      : null;
    if (!filter) {
      return;
    }

    const process = await this.plugin.db.getRepository(PROCESS_COLLECTION).findOne({
      filterByTk: processId,
      filter,
    });
    if (!process) {
      throw new ProcessDocumentsError('PROCESS_ACCESS_DENIED', 'Нет прав для действия с документами процесса.');
    }
  }

  private actionFor(operation: ProcessDocumentOperation): string {
    if (operation === 'read') {
      return 'get';
    }
    if (operation === 'delete') {
      return 'destroy';
    }
    return 'update';
  }
}
