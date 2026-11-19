/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { BlockModel } from '@nocobase/client';
import { getProcessBlockModelContext } from '@log-company/plugin-process-governance/client';
import { catalogIdentifier, runCatalogTitle } from '../../../entities/process-document';
import { CompanyFilesBlock } from '../ui/CompanyFilesBlock';
import type { CatalogNode } from '../ui/CompanyFilesBlock';

export class CompanyFilesBlockModel extends BlockModel {
  renderComponent() {
    const context = getProcessBlockModelContext(this, this.context);
    const collection =
      typeof context.collection === 'string'
        ? context.collection
        : (context.collection as { name?: string } | undefined)?.name;
    const id = catalogIdentifier(context.filterByTk) ?? catalogIdentifier(context.record?.id);
    const name = context.record?.name;
    let root: CatalogNode | undefined;
    if (this.props.source === 'fixed' || this.props.source === 'fixed-company') {
      const companyId = catalogIdentifier(this.props.companyId);
      const folderId = catalogIdentifier(this.props.folderId);
      if (companyId && folderId) {
        root = {
          type: 'corporate',
          company: { id: companyId, title: 'Компания' },
          folderId,
          ...(this.props.source === 'fixed-company' && { companyArea: 'company' }),
        };
      }
    } else if (this.props.source === 'catalog' || !collection) {
      root = { type: 'catalog' };
    } else if (id !== undefined) {
      if (collection === 'our_companies') {
        const company = { id, title: typeof name === 'string' ? name : 'Компания' };
        const type =
          this.props.source === 'corporate' ? 'corporate' : this.props.source === 'permits' ? 'permits' : 'company';
        root = { type, company };
      } else if (collection === 'transport_runs') {
        root = { type: 'run', run: { id, title: runCatalogTitle(context.record ?? {}, id) } };
      } else if (collection === 'shipments') {
        root = { type: 'shipment', shipment: { id, title: `Поставка №${context.record?.shipment_number ?? id}` } };
      } else if (collection === 'permit_documents') {
        root = { type: 'permit', permit: { id, title: String(context.record?.title ?? 'Разрешительный документ') } };
      }
    }
    return (
      <CompanyFilesBlock
        root={root}
        readOnly={this.props.readOnly === true}
        openInWindow={this.props.openInWindow === true}
      />
    );
  }
}

CompanyFilesBlockModel.define({ label: 'Файловый менеджер', sort: 548 });
CompanyFilesBlockModel.registerFlow({
  key: 'companyFilesSettings',
  title: 'Настройки файлового менеджера',
  steps: {
    source: {
      title: 'Папка и действия',
      uiSchema: {
        source: {
          type: 'string',
          title: 'Раздел',
          'x-decorator': 'FormItem',
          'x-component': 'Select',
          enum: [
            { value: 'auto', label: 'По текущей карточке' },
            { value: 'catalog', label: 'Все доступные компании' },
            { value: 'corporate', label: 'Учредительные документы текущей компании' },
            { value: 'permits', label: 'Разрешительные документы текущей компании' },
            { value: 'fixed', label: 'Конкретная папка учредительных документов' },
            { value: 'fixed-company', label: 'Конкретная папка компании' },
          ],
        },
        companyId: {
          type: 'string',
          title: 'ID компании (для конкретной папки)',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
        },
        folderId: {
          type: 'string',
          title: 'ID папки (для конкретной папки)',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
        },
        openInWindow: {
          type: 'boolean',
          title: 'Открывать в отдельном окне',
          'x-decorator': 'FormItem',
          'x-component': 'Switch',
        },
        readOnly: { type: 'boolean', title: 'Только просмотр', 'x-decorator': 'FormItem', 'x-component': 'Switch' },
      },
      defaultParams: (ctx) => ({
        source: ctx.model.props.source || 'auto',
        readOnly: ctx.model.props.readOnly === true,
        companyId: ctx.model.props.companyId,
        folderId: ctx.model.props.folderId,
        openInWindow: ctx.model.props.openInWindow === true,
      }),
      handler(ctx, params) {
        ctx.model.setProps('source', params.source);
        ctx.model.setProps('readOnly', params.readOnly);
        ctx.model.setProps('companyId', params.companyId);
        ctx.model.setProps('folderId', params.folderId);
        ctx.model.setProps('openInWindow', params.openInWindow);
      },
    },
  },
});
