/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ApartmentOutlined } from '@ant-design/icons';
import { ActionModel, ActionSceneEnum } from '@nocobase/client';
import { Button, Modal, type ButtonProps } from 'antd';
import React, { useState } from 'react';
import { RunTreeBlock } from './RunTreeBlock';

type RunRecord = {
  id?: string | number;
  run_number?: string | number;
};

function collectionName(collection: unknown): string {
  if (!collection || typeof collection !== 'object' || Array.isArray(collection)) {
    return '';
  }
  const value = collection as { name?: unknown; collectionName?: unknown };
  if (typeof value.name === 'string') {
    return value.name;
  }
  return typeof value.collectionName === 'string' ? value.collectionName : '';
}

export function isTransportRunActionContext(context: unknown): boolean {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return false;
  }
  const value = context as { collection?: unknown; blockModel?: { collection?: unknown } };
  return collectionName(value.collection ?? value.blockModel?.collection) === 'transport_runs';
}

function actionRecord(model: RunTreeActionModel): RunRecord {
  const record = model.context.record;
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return {};
  }
  const value = record as RunRecord & { get?: (key: string) => unknown };
  const id = value.id ?? value.get?.('id');
  const runNumber = value.run_number ?? value.get?.('run_number');
  return {
    id: typeof id === 'string' || typeof id === 'number' ? id : undefined,
    run_number: typeof runNumber === 'string' || typeof runNumber === 'number' ? runNumber : undefined,
  };
}

function RunTreeAction({ model }: { model: RunTreeActionModel }) {
  const [open, setOpen] = useState(false);
  const record = actionRecord(model);
  const { title, ...buttonProps } = model.props;
  const dialogTitle = record.run_number ? `Дерево рейса №${record.run_number}` : 'Дерево рейса';

  return (
    <>
      <Button
        {...buttonProps}
        type={buttonProps.type || 'link'}
        icon={<ApartmentOutlined aria-hidden />}
        disabled={!record.id || buttonProps.disabled}
        onClick={() => setOpen(true)}
      >
        {title || 'Дерево рейсов'}
      </Button>
      <Modal destroyOnClose footer={null} open={open} width={980} title={dialogTitle} onCancel={() => setOpen(false)}>
        <RunTreeBlock entityKind="run" recordId={record.id} />
      </Modal>
    </>
  );
}

export class RunTreeActionModel extends ActionModel {
  static scene = ActionSceneEnum.record;

  defaultProps: ButtonProps = {
    type: 'link',
    title: 'Дерево рейсов',
    icon: 'ApartmentOutlined',
  };

  getAclActionName() {
    return 'view';
  }

  render() {
    return <RunTreeAction model={this} />;
  }
}

RunTreeActionModel.define({
  label: 'Дерево рейсов',
  sort: 55,
  hide(context) {
    return !isTransportRunActionContext(context);
  },
});
