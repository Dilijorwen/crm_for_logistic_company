/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database, Model, Transaction } from '@nocobase/database';

const EDIT_FIELDS = [
  ['title', 'InputFieldModel'],
  ['category', 'SelectFieldModel'],
  ['document_type', 'SelectFieldModel'],
  ['company', 'RecordSelectFieldModel'],
  ['rental_from', 'DateOnlyFieldModel'],
  ['rental_until', 'DateOnlyFieldModel'],
  ['valid_from', 'DateOnlyFieldModel'],
  ['valid_until', 'DateOnlyFieldModel'],
  ['product_information', 'TextareaFieldModel'],
  ['manufacturer_name', 'TextareaFieldModel'],
  ['manufacturer_address', 'TextareaFieldModel'],
  ['technical_regulations', 'RecordSelectFieldModel'],
  ['documents', 'UploadFieldModel'],
] as const;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function ensurePermitDocumentEditFields(db: Database, transaction: Transaction): Promise<void> {
  return appendPermitDocumentFields(db, transaction, { EditFormModel: EDIT_FIELDS });
}

export function ensurePermitDocumentMarkingFields(db: Database, transaction: Transaction): Promise<void> {
  const markingInput = [['marking', 'TextareaFieldModel']] as const;
  return appendPermitDocumentFields(db, transaction, {
    CreateFormModel: markingInput,
    EditFormModel: markingInput,
    DetailsBlockModel: [['marking', 'DisplayTextFieldModel']],
  });
}

/** Append missing native items while retaining the saved layout and popup actions. */
async function appendPermitDocumentFields(
  db: Database,
  transaction: Transaction,
  fieldsByBlock: Partial<Record<string, ReadonlyArray<readonly [fieldPath: string, use: string]>>>,
): Promise<void> {
  if (!db.getCollection('flowModels')) return;
  const repository = db.getRepository('flowModels');
  const models: Model[] = await repository.find({ transaction });
  const optionsOf = (model: Model) => object(model.get('options'));
  const paths: Model[] = await db.getRepository('flowModelTreePath').find({ filter: { depth: 1 }, transaction });
  const parents = new Map(paths.map((path) => [String(path.get('descendant')), String(path.get('ancestor'))]));
  const parentOf = (model: Model) => parents.get(String(model.get('uid'))) ?? optionsOf(model).parentId;
  const flowRepository = repository as unknown as {
    upsertModel(options: Record<string, unknown>, context: { transaction: Transaction }): Promise<unknown>;
    attach(
      uid: string,
      target: { parentId: string; subKey: string; subType: 'array' | 'object'; position: 'last' },
      context: { transaction: Transaction },
    ): Promise<unknown>;
  };
  for (const block of models) {
    const options = optionsOf(block);
    const init = object(object(object(options.stepParams).resourceSettings).init);
    if (init.collectionName !== 'permit_documents' || (init.dataSourceKey ?? 'main') !== 'main') continue;
    const fields = fieldsByBlock[String(options.use)];
    if (!Array.isArray(fields)) continue;
    const isDetails = options.use === 'DetailsBlockModel';
    const grid = models.find(
      (candidate) => parentOf(candidate) === block.get('uid') && optionsOf(candidate).subKey === 'grid',
    );
    if (!grid) continue;
    const gridUid = String(grid.get('uid'));
    const children = models.filter(
      (candidate) => parentOf(candidate) === gridUid && optionsOf(candidate).subKey === 'items',
    );
    const existing = new Set(
      children.map((child) => object(object(object(optionsOf(child).stepParams).fieldSettings).init).fieldPath),
    );
    const appended: string[] = [];
    for (const [fieldPath, use] of fields) {
      if (existing.has(fieldPath)) continue;
      const uid = `pde${block.get('uid')}${fieldPath}`;
      await flowRepository.upsertModel(
        {
          uid,
          use: isDetails ? 'DetailsItemModel' : 'FormItemModel',
          parentId: gridUid,
          subKey: 'items',
          subType: 'array',
          stepParams: {
            fieldSettings: {
              init: { dataSourceKey: init.dataSourceKey ?? 'main', collectionName: 'permit_documents', fieldPath },
            },
            ...(isDetails ? { detailItemSettings: { model: { use } } } : {}),
          },
          subModels: { field: { uid: `${uid}${isDetails ? 'field' : 'input'}`, use } },
        },
        { transaction },
      );
      await flowRepository.attach(
        uid,
        { parentId: gridUid, subKey: 'items', subType: 'array', position: 'last' },
        { transaction },
      );
      appended.push(uid);
    }
    if (!appended.length) continue;
    const stepParams = object(optionsOf(grid).stepParams);
    const gridSettings = object(stepParams.gridSettings);
    const settings = object(gridSettings.grid);
    const layout = object(settings.layout);
    let next: Record<string, unknown>;
    if (layout.version === 2 && Array.isArray(layout.rows)) {
      next = {
        ...settings,
        layout: {
          ...layout,
          rows: [
            ...layout.rows,
            ...appended.map((uid) => ({ id: `${uid}row`, cells: [{ id: `${uid}cell`, items: [uid] }], sizes: [24] })),
          ],
        },
      };
    } else if (Object.keys(object(settings.rows)).length) {
      next = {
        ...settings,
        rows: { ...object(settings.rows), ...Object.fromEntries(appended.map((uid) => [`${uid}row`, [[uid]]])) },
        sizes: { ...object(settings.sizes), ...Object.fromEntries(appended.map((uid) => [`${uid}row`, [24]])) },
      };
    } else continue;
    await flowRepository.upsertModel(
      { uid: gridUid, stepParams: { ...stepParams, gridSettings: { ...gridSettings, grid: next } } },
      { transaction },
    );
  }
}
