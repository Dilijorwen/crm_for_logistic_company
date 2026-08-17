/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { SearchOutlined } from '@ant-design/icons';
import { ActionModel, ActionSceneEnum, useCompile } from '@nocobase/client';
import { tExpr } from '@nocobase/flow-engine';
import { Button, Modal, Tooltip } from 'antd';
import type { ButtonProps } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../../locale';
import { resolveCurrentCollection } from './collectionContext';
import { CollectionSearchPanel } from '../ui/CollectionSearchPanel';

function CollectionSearchAction({ model }: { model: CollectionSearchActionModel }) {
  const { t } = useTranslation(NAMESPACE);
  const compile = useCompile();
  const [open, setOpen] = useState(false);
  const collection = resolveCurrentCollection(model.context.collection, model);
  const { iconOnly, tooltip, title, ...buttonProps } = model.props;
  const button = (
    <Button
      {...buttonProps}
      icon={<SearchOutlined aria-hidden />}
      aria-label={iconOnly ? t('action.title') : undefined}
      onClick={() => setOpen(true)}
    >
      {iconOnly ? null : buttonProps.children || title || t('action.title')}
    </Button>
  );
  return (
    <>
      {tooltip ? <Tooltip title={tooltip}>{button}</Tooltip> : button}
      <Modal
        destroyOnClose
        footer={null}
        open={open}
        width={960}
        title={t('dialog.title', { collection: String(compile(collection?.title || '') ?? '') })}
        onCancel={() => setOpen(false)}
      >
        <CollectionSearchPanel collection={model.context.collection} model={model} />
      </Modal>
    </>
  );
}

export class CollectionSearchActionModel extends ActionModel {
  static scene = ActionSceneEnum.collection;

  defaultProps: ButtonProps = {
    title: tExpr('action.title', { ns: NAMESPACE }),
    icon: 'SearchOutlined',
  };

  getAclActionName() {
    return 'list';
  }

  render() {
    return <CollectionSearchAction model={this} />;
  }
}

CollectionSearchActionModel.define({
  label: tExpr('action.title', { ns: NAMESPACE }),
  sort: 80,
});
