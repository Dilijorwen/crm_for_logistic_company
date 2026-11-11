/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Alert, Button, Modal, Select, Space, Spin, Tag } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import type { OrganizationStructureService } from '../api/organizationStructureService';
import type { Identifier, RoleReference } from '../model/types';

interface EditEmployeeRolesModalProps {
  employeeId: Identifier;
  employeeName: string;
  service: Pick<OrganizationStructureService, 'getEmployeeRoles' | 'getAssignableRoles'>;
  onClose: () => void;
  onSave: (roleNames: string[]) => Promise<void>;
}

type RoleEditorState =
  | { status: 'loading' | 'error' }
  | { status: 'ready'; assigned: RoleReference[]; options: RoleReference[] };

export function EditEmployeeRolesModal({
  employeeId,
  employeeName,
  service,
  onClose,
  onSave,
}: EditEmployeeRolesModalProps) {
  const [editor, setEditor] = useState<RoleEditorState>({ status: 'loading' });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);
  const saving = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([service.getEmployeeRoles(employeeId), service.getAssignableRoles()])
      .then(([assigned, options]) => {
        if (active) {
          setSelected(
            assigned.filter((role) => options.some(({ name }) => name === role.name)).map(({ name }) => name),
          );
          setEditor({ status: 'ready', assigned, options });
        }
      })
      .catch(() => {
        if (active) {
          setEditor({ status: 'error' });
        }
      });
    return () => {
      active = false;
    };
  }, [employeeId, loadAttempt, service]);

  const lockedRoles =
    editor.status === 'ready'
      ? editor.assigned.filter(({ name }) => !editor.options.some((role) => role.name === name))
      : [];
  const roleNames = [...selected, ...lockedRoles.map(({ name }) => name)];
  const hasChanges =
    editor.status === 'ready' &&
    (roleNames.length !== editor.assigned.length || editor.assigned.some(({ name }) => !roleNames.includes(name)));

  const save = async () => {
    if (!hasChanges || saving.current) {
      return;
    }
    saving.current = true;
    setIsSaving(true);
    setHasSaveError(false);
    try {
      await onSave(roleNames);
    } catch {
      setHasSaveError(true);
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open
      title={`Изменить роли — ${employeeName}`}
      okText="Сохранить"
      cancelText="Отмена"
      okButtonProps={{ disabled: !hasChanges }}
      cancelButtonProps={{ disabled: isSaving }}
      closable={!isSaving}
      confirmLoading={isSaving}
      maskClosable={!isSaving}
      keyboard={!isSaving}
      onCancel={isSaving ? undefined : onClose}
      onOk={save}
    >
      {editor.status === 'loading' && <Spin aria-label="Загрузка ролей" />}
      {editor.status === 'error' && (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить роли сотрудника или список доступных ролей."
          action={
            <Button
              size="small"
              onClick={() => {
                setEditor({ status: 'loading' });
                setLoadAttempt((attempt) => attempt + 1);
              }}
            >
              Повторить
            </Button>
          }
        />
      )}
      {editor.status === 'ready' && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select<string[]>
            aria-label="Роли сотрудника"
            mode="multiple"
            allowClear
            disabled={isSaving || editor.options.length === 0}
            placeholder={editor.options.length ? 'Выберите роли' : 'Нет доступных ролей'}
            options={editor.options.map(({ name, title }) => ({ value: name, label: title }))}
            optionFilterProp="label"
            style={{ width: '100%' }}
            value={selected}
            onChange={setSelected}
          />
          {lockedRoles.length > 0 && (
            <div>
              <div>Роли вне списка выбора сохранятся</div>
              {lockedRoles.map(({ name, title }) => (
                <Tag key={name}>{title}</Tag>
              ))}
            </div>
          )}
          {hasSaveError && (
            <Alert type="error" showIcon message="Не удалось сохранить роли. Проверьте права и повторите попытку." />
          )}
        </Space>
      )}
    </Modal>
  );
}
