/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DeleteOutlined, EditOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons';
import { ActionModel, ActionSceneEnum, useAPIClient } from '@nocobase/client';
import { App, Button, type ButtonProps } from 'antd';
import React, { useCallback, useMemo, useState } from 'react';
import { apiErrorMessage } from '../api/apiResponse';
import { LogisticsService } from '../api/LogisticsService';
import type { LogisticsReferenceData, ShipmentRecord, TransportRunRecord } from '../model/types';
import { useLogisticsPermissions } from '../model/useLogisticsPermissions';
import { isLogisticsWorkspaceContext, logisticsWorkspaceRecordIds } from '../model/workspaceRecord';
import { RunModal } from './RunModal';
import { ShipmentFormModal } from './ShipmentFormModal';
import './styles.less';

const EMPTY_REFERENCE_DATA: LogisticsReferenceData = {
  chineseClients: [],
  companies: [],
  contracts: [],
  customsWarehouses: [],
  departureCities: [],
  users: [],
};

type WorkspaceButtonProps = ButtonProps & { title?: React.ReactNode; icon?: unknown };
type RunModalTab = 'run' | 'shipments';

interface RefreshableWorkspace {
  refresh?: () => Promise<unknown>;
}

function buttonProps(model: ActionModel): { title: React.ReactNode; props: ButtonProps } {
  const props = model.props as WorkspaceButtonProps;
  const { title, icon: _icon, ...rest } = props;
  return { title, props: rest };
}

async function refreshWorkspace(model: ActionModel): Promise<void> {
  const blockModel = model.context.blockModel as { resource?: RefreshableWorkspace } | undefined;
  if (typeof blockModel?.resource?.refresh === 'function') {
    await blockModel.resource.refresh();
  }
}

function workspaceIds(model: ActionModel) {
  return logisticsWorkspaceRecordIds(model.context.record);
}

function useWorkspaceServices() {
  const api = useAPIClient();
  const service = useMemo(() => new LogisticsService(api), [api]);
  const permissions = useLogisticsPermissions();
  return { service, permissions };
}

function NewRunAction({ model }: { model: LogisticsWorkspaceNewRunActionModel }) {
  const { message } = App.useApp();
  const { service, permissions } = useWorkspaceServices();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<TransportRunRecord[]>([]);
  const [referenceData, setReferenceData] = useState<LogisticsReferenceData>(EMPTY_REFERENCE_DATA);
  const { title, props } = buttonProps(model);

  const openModal = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [availableRuns, references] = await Promise.all([service.getRuns(), service.getReferenceData()]);
      setRuns(availableRuns);
      setReferenceData(references);
      setOpen(true);
    } catch (reason) {
      message.error(apiErrorMessage(reason, 'Не удалось открыть форму рейса'));
    } finally {
      setLoading(false);
    }
  }, [message, service]);

  const handleChanged = useCallback(async (): Promise<void> => {
    const updatedRuns = await service.getRuns();
    setRuns(updatedRuns);
    await refreshWorkspace(model);
  }, [model, service]);

  return (
    <>
      <Button
        {...props}
        type={props.type || 'primary'}
        icon={<PlusOutlined aria-hidden />}
        loading={loading}
        disabled={!permissions.canCreateRun || props.disabled}
        onClick={openModal}
      >
        {title || 'Новый рейс'}
      </Button>
      <RunModal
        open={open}
        run={null}
        runs={runs}
        referenceData={referenceData}
        service={service}
        permissions={permissions}
        onClose={() => setOpen(false)}
        onChanged={handleChanged}
      />
    </>
  );
}

function RunAction({ model, initialTab }: { model: ActionModel; initialTab: RunModalTab }) {
  const { message } = App.useApp();
  const { service, permissions } = useWorkspaceServices();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState<TransportRunRecord | null>(null);
  const [runs, setRuns] = useState<TransportRunRecord[]>([]);
  const [referenceData, setReferenceData] = useState<LogisticsReferenceData>(EMPTY_REFERENCE_DATA);
  const ids = workspaceIds(model);
  const { title, props } = buttonProps(model);

  const openModal = useCallback(async (): Promise<void> => {
    if (!ids) {
      message.error('Не удалось определить рейс в рабочей строке');
      return;
    }
    setLoading(true);
    try {
      const [currentRun, availableRuns, references] = await Promise.all([
        service.getRun(ids.runId),
        service.getRuns(),
        service.getReferenceData(),
      ]);
      setRun(currentRun);
      setRuns(availableRuns);
      setReferenceData(references);
      setOpen(true);
    } catch (reason) {
      message.error(apiErrorMessage(reason, 'Не удалось открыть рейс'));
    } finally {
      setLoading(false);
    }
  }, [ids, message, service]);

  const handleChanged = useCallback(async (): Promise<void> => {
    const updatedRuns = await service.getRuns();
    setRuns(updatedRuns);
    await refreshWorkspace(model);
  }, [model, service]);

  const canEdit = ids ? permissions.canUpdateRun(ids.runId) : false;
  const defaultTitle = initialTab === 'shipments' ? 'Поставки' : 'Рейс';
  return (
    <>
      <Button
        {...props}
        type={props.type || 'link'}
        icon={initialTab === 'shipments' ? <LinkOutlined aria-hidden /> : <EditOutlined aria-hidden />}
        loading={loading}
        disabled={!ids || (!permissions.canViewRuns && !canEdit) || props.disabled}
        onClick={openModal}
      >
        {title || defaultTitle}
      </Button>
      <RunModal
        open={open}
        run={run}
        runs={runs}
        initialTab={initialTab}
        referenceData={referenceData}
        service={service}
        permissions={permissions}
        onClose={() => setOpen(false)}
        onChanged={handleChanged}
      />
    </>
  );
}

function ShipmentAction({ model }: { model: LogisticsWorkspaceShipmentActionModel }) {
  const { message } = App.useApp();
  const { service, permissions } = useWorkspaceServices();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shipment, setShipment] = useState<ShipmentRecord | null>(null);
  const [referenceData, setReferenceData] = useState<LogisticsReferenceData>(EMPTY_REFERENCE_DATA);
  const ids = workspaceIds(model);
  const { title, props } = buttonProps(model);

  const openModal = useCallback(async (): Promise<void> => {
    if (!ids?.shipmentId) {
      return;
    }
    setLoading(true);
    try {
      const [currentShipment, references] = await Promise.all([
        service.getShipment(ids.shipmentId),
        service.getReferenceData(),
      ]);
      setShipment(currentShipment);
      setReferenceData(references);
      setOpen(true);
    } catch (reason) {
      message.error(apiErrorMessage(reason, 'Не удалось открыть поставку'));
    } finally {
      setLoading(false);
    }
  }, [ids?.shipmentId, message, service]);

  const handleSaved = useCallback(async (): Promise<void> => {
    setOpen(false);
    await refreshWorkspace(model);
    message.success('Поставка обновлена');
  }, [message, model]);

  return (
    <>
      <Button
        {...props}
        type={props.type || 'link'}
        icon={<EditOutlined aria-hidden />}
        loading={loading}
        disabled={!ids?.shipmentId || props.disabled}
        onClick={openModal}
      >
        {title || 'Поставка'}
      </Button>
      <ShipmentFormModal
        open={open}
        shipment={shipment}
        referenceData={referenceData}
        service={service}
        canSave={shipment ? permissions.canUpdateShipment(shipment.id) : false}
        onClose={() => setOpen(false)}
        onSaved={handleSaved}
      />
    </>
  );
}

function DeleteRunAction({ model }: { model: LogisticsWorkspaceDeleteRunActionModel }) {
  const { message, modal } = App.useApp();
  const { service, permissions } = useWorkspaceServices();
  const ids = workspaceIds(model);
  const { title, props } = buttonProps(model);

  const deleteRun = useCallback((): void => {
    if (!ids) {
      return;
    }
    modal.confirm({
      title: 'Удалить рейс?',
      content: 'Связанные поставки сохранятся; удалятся только рейс и его связи.',
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      async onOk() {
        try {
          await service.deleteRun(ids.runId);
          await refreshWorkspace(model);
          message.success('Рейс удалён');
        } catch (reason) {
          message.error(apiErrorMessage(reason, 'Не удалось удалить рейс'));
          throw reason;
        }
      },
    });
  }, [ids, message, modal, model, service]);

  return (
    <Button
      {...props}
      type={props.type || 'link'}
      danger
      icon={<DeleteOutlined aria-hidden />}
      disabled={!ids || !permissions.canDeleteRun(ids.runId) || props.disabled}
      onClick={deleteRun}
    >
      {title || 'Удалить'}
    </Button>
  );
}

export class LogisticsWorkspaceNewRunActionModel extends ActionModel {
  static scene = ActionSceneEnum.collection;

  defaultProps: WorkspaceButtonProps = { type: 'primary', title: 'Новый рейс', icon: 'PlusOutlined' };

  getAclActionName() {
    return 'view';
  }

  render() {
    return <NewRunAction model={this} />;
  }
}

LogisticsWorkspaceNewRunActionModel.define({
  label: 'Новый рейс',
  sort: 61,
  hide: (context) => !isLogisticsWorkspaceContext(context),
});

export class LogisticsWorkspaceRunActionModel extends ActionModel {
  static scene = ActionSceneEnum.record;

  defaultProps: WorkspaceButtonProps = { type: 'link', title: 'Рейс', icon: 'EditOutlined' };

  getAclActionName() {
    return 'view';
  }

  render() {
    return <RunAction model={this} initialTab="run" />;
  }
}

LogisticsWorkspaceRunActionModel.define({
  label: 'Открыть рейс',
  sort: 56,
  hide: (context) => !isLogisticsWorkspaceContext(context),
});

export class LogisticsWorkspaceLinksActionModel extends ActionModel {
  static scene = ActionSceneEnum.record;

  defaultProps: WorkspaceButtonProps = { type: 'link', title: 'Поставки', icon: 'LinkOutlined' };

  getAclActionName() {
    return 'view';
  }

  render() {
    return <RunAction model={this} initialTab="shipments" />;
  }
}

LogisticsWorkspaceLinksActionModel.define({
  label: 'Поставки рейса',
  sort: 57,
  hide: (context) => !isLogisticsWorkspaceContext(context),
});

export class LogisticsWorkspaceShipmentActionModel extends ActionModel {
  static scene = ActionSceneEnum.record;

  defaultProps: WorkspaceButtonProps = { type: 'link', title: 'Поставка', icon: 'EditOutlined' };

  getAclActionName() {
    return 'view';
  }

  render() {
    return <ShipmentAction model={this} />;
  }
}

LogisticsWorkspaceShipmentActionModel.define({
  label: 'Открыть поставку',
  sort: 58,
  hide: (context) => !isLogisticsWorkspaceContext(context),
});

export class LogisticsWorkspaceDeleteRunActionModel extends ActionModel {
  static scene = ActionSceneEnum.record;

  defaultProps: WorkspaceButtonProps = { type: 'link', title: 'Удалить', icon: 'DeleteOutlined', danger: true };

  getAclActionName() {
    return 'view';
  }

  render() {
    return <DeleteRunAction model={this} />;
  }
}

LogisticsWorkspaceDeleteRunActionModel.define({
  label: 'Удалить рейс',
  sort: 59,
  hide: (context) => !isLogisticsWorkspaceContext(context),
});
