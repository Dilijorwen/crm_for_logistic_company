/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context } from '@nocobase/actions';
import type { Plugin } from '@nocobase/server';
import { DeleteWorkspaceShipments, WorkspaceDeletionError } from '../../application/logistics/DeleteWorkspaceShipments';
import { NocoBaseWorkspaceDeletion } from '../../infrastructure/persistence/nocobase/NocoBaseWorkspaceDeletion';

export class WorkspaceDeletionController {
  constructor(private readonly plugin: Plugin) {}

  register(): void {
    this.plugin.app.acl.allow('logisticsWorkspace', 'destroyShipments', (context) =>
      Boolean(context.state.currentUser && context.can?.({ resource: 'shipments', action: 'destroy' })),
    );
    this.plugin.app.acl.allow('logisticsWorkspace', 'destroySelection', (context) =>
      Boolean(
        context.state.currentUser &&
          ['shipments', 'transport_runs'].some((resource) => context.can?.({ resource, action: 'destroy' })),
      ),
    );
    this.plugin.app.resourceManager.define({
      name: 'logisticsWorkspace',
      actions: {
        destroySelection: async (context: Context, next) => {
          if (context.method !== 'POST') context.throw(405);
          try {
            context.body = await new DeleteWorkspaceShipments(
              new NocoBaseWorkspaceDeletion(this.plugin.db, context),
            ).executeSelection(context.action.params.values);
          } catch (error) {
            if (error instanceof WorkspaceDeletionError) {
              context.throw(
                error.code === 'INVALID_SELECTION' ? 400 : error.code === 'NOT_FOUND' ? 404 : 403,
                error.message,
              );
              return;
            }
            this.plugin.app.logger.error('[logistics-workspace] Failed to delete selection', { error });
            context.throw(500, 'Не удалось удалить выбранные записи. Изменения отменены.');
          }
          await next();
        },
        destroyShipments: async (context: Context, next) => {
          try {
            const values: unknown = context.action.params.values;
            const rowIds =
              values && typeof values === 'object' && !Array.isArray(values)
                ? (values as Record<string, unknown>).rowIds
                : undefined;
            context.body = await new DeleteWorkspaceShipments(
              new NocoBaseWorkspaceDeletion(this.plugin.db, context),
            ).execute(rowIds);
          } catch (error) {
            if (error instanceof WorkspaceDeletionError) {
              const status = error.code === 'INVALID_SELECTION' ? 400 : error.code === 'NOT_FOUND' ? 404 : 403;
              context.throw(status, error.message);
              return;
            }
            this.plugin.app.logger.error('[logistics-workspace] Failed to delete selected shipments', { error });
            context.throw(500, 'Не удалось удалить выбранные поставки. Изменения отменены.');
          }
          await next();
        },
      },
    });
  }
}
