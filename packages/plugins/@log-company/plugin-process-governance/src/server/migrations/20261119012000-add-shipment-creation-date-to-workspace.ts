/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Model, Transaction } from '@nocobase/database';
import { Migration } from '@nocobase/server';
import logisticsWorkItems from '../collections/logisticsWorkItems';
import { assignWorkspaceParents, workspaceColumn } from '../infrastructure/metadata/LogisticsWorkspaceNativeModels';
import type { WorkspaceFlowTree } from '../infrastructure/metadata/LogisticsWorkspaceNativeModels';
import { LOGISTICS_WORKSPACE_VIEW_WITH_SHIPMENT_CREATION_DATE_SQL } from '../infrastructure/read-model/LogisticsWorkspaceViewSql';

const fieldName = 'shipment_created_at';
const tableUid = 'lclogworkspacetable';

interface Models {
  findModelById(uid: string, options: { transaction: Transaction }): Promise<WorkspaceFlowTree | null>;
  upsertModel(model: WorkspaceFlowTree, options: { transaction: Transaction }): Promise<unknown>;
  attach(
    uid: string,
    target: {
      parentId: string;
      subKey: 'columns';
      subType: 'array';
      position: 'first' | { type: 'after'; target: string };
    },
    options: { transaction: Transaction },
  ): Promise<unknown>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.db.sequelize.transaction(async (transaction) => {
      await this.db.sequelize.query(LOGISTICS_WORKSPACE_VIEW_WITH_SHIPMENT_CREATION_DATE_SQL, { transaction });
      const definition = logisticsWorkItems.fields?.find((field) => field.name === fieldName);
      if (!definition?.uiSchema) throw new Error('Не найдены настройки поля даты создания поставки.');
      const fields = this.db.getRepository('fields');
      const filter = { collectionName: logisticsWorkItems.name, name: fieldName };
      if (!(await fields.findOne({ filter, transaction }))) {
        await fields.create({ values: { collectionName: logisticsWorkItems.name, ...definition }, transaction });
      }
      await this.allowWorkspaceField(transaction);
      await this.addColumn(String(definition.uiSchema.title), transaction);
    });
  }

  private async addColumn(title: string, transaction: Transaction): Promise<void> {
    const models = this.db.getRepository('flowModels') as unknown as Models;
    const table = await models.findModelById(tableUid, { transaction });
    if (!table) return;
    const columns = table.subModels?.columns;
    const existing = Array.isArray(columns) ? columns : [];
    const binding = (column: WorkspaceFlowTree) =>
      (column.stepParams?.fieldSettings as { init?: { fieldPath?: string } } | undefined)?.init?.fieldPath;
    if (existing.some((column) => binding(column) === fieldName)) return;
    const number = existing.find((column) => binding(column) === 'shipment_number');
    const column = workspaceColumn('lcwsshipmentcreatedat', logisticsWorkItems.name, fieldName);
    column.props = { title, width: 175 };
    assignWorkspaceParents(column);
    await models.upsertModel(column, { transaction });
    await models.attach(
      column.uid,
      {
        parentId: tableUid,
        subKey: 'columns',
        subType: 'array',
        position: number ? { type: 'after', target: number.uid } : 'first',
      },
      { transaction },
    );
  }

  private async allowWorkspaceField(transaction: Transaction): Promise<void> {
    const resources = this.db.getRepository('dataSourcesRolesResources');
    const actions = this.db.getRepository('dataSourcesRolesResourcesActions');
    const rules: Model[] = await resources.find({
      filter: { dataSourceKey: 'main', name: { $in: ['shipments', logisticsWorkItems.name] } },
      transaction,
    });
    const ruleIds = rules.map((rule) => rule.get('id'));
    if (!ruleIds.length) return;
    const views: Model[] = await actions.find({
      filter: { rolesResourceId: { $in: ruleIds }, name: 'view' },
      transaction,
    });
    const viewByResource = new Map(views.map((view) => [String(view.get('rolesResourceId')), view]));
    const sourceByRole = new Map(
      rules.filter((rule) => rule.get('name') === 'shipments').map((rule) => [rule.get('roleName'), rule]),
    );
    for (const rule of rules.filter((item) => item.get('name') === logisticsWorkItems.name)) {
      const source = sourceByRole.get(rule.get('roleName'));
      const sourceView = source && viewByResource.get(String(source.get('id')));
      const view = viewByResource.get(String(rule.get('id')));
      const sourceFields: unknown = sourceView?.get('fields');
      const visible: unknown = view?.get('fields');
      if (
        view &&
        sourceView &&
        (!Array.isArray(sourceFields) || sourceFields.includes('createdAt')) &&
        Array.isArray(visible) &&
        visible.includes('shipment_number') &&
        !visible.includes(fieldName)
      ) {
        await view.update({ fields: [...visible, fieldName] }, { transaction });
      }
    }
  }
}
