/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { App, Flex, Result, Skeleton, Typography, theme } from 'antd';
import React, { useState } from 'react';
import { useOrganizationTranslation } from '../../../locale';
import { apiErrorMessage } from '../api/apiResponse';
import { useOrganizationPermissions } from '../hooks/useOrganizationPermissions';
import { useOrganizationStructure } from '../hooks/useOrganizationStructure';
import type { FocusTarget, Identifier, OrganizationDepartment, OrganizationEmployee } from '../model/types';
import { AssignEmployeeModal } from './AssignEmployeeModal';
import { CreateEmployeeModal } from './CreateEmployeeModal';
import { DepartmentFormModal } from './DepartmentFormModal';
import { DepartmentSidebar } from './DepartmentSidebar';
import { DepartmentMembersModal, UserDetailsModal } from './DetailsModals';
import { EmployeeSidebar } from './EmployeeSidebar';
import { AddEmployeesModal, ManagerModal } from './ManageEmployeesModal';
import { MoveDepartmentModal } from './MoveDepartmentModal';
import { OrganizationCanvas } from './OrganizationCanvas';
import './styles.less';

interface DepartmentFormState {
  department?: OrganizationDepartment;
  initialParentId: Identifier | null;
}

export function OrganizationStructurePage() {
  const { t } = useOrganizationTranslation();
  const { message, modal } = App.useApp();
  const { token } = theme.useToken();
  const state = useOrganizationStructure();
  const permissions = useOrganizationPermissions();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<Identifier | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const [departmentForm, setDepartmentForm] = useState<DepartmentFormState | null>(null);
  const [moveDepartment, setMoveDepartment] = useState<OrganizationDepartment | null>(null);
  const [assignEmployee, setAssignEmployee] = useState<OrganizationEmployee | null>(null);
  const [createEmployeeOpen, setCreateEmployeeOpen] = useState(false);
  const [addEmployeesDepartment, setAddEmployeesDepartment] = useState<OrganizationDepartment | null>(null);
  const [managerDepartment, setManagerDepartment] = useState<OrganizationDepartment | null>(null);
  const [membersDepartment, setMembersDepartment] = useState<OrganizationDepartment | null>(null);
  const [userDetails, setUserDetails] = useState<OrganizationEmployee | null>(null);

  const showMutationError = (error: unknown): void => {
    message.error(apiErrorMessage(error, t('errors.mutation')));
  };

  const locate = (departmentId: Identifier, employeeId?: Identifier): void => {
    setSelectedDepartmentId(departmentId);
    setFocusTarget({ departmentId, employeeId, revision: Date.now() });
  };

  const confirmDeleteDepartment = (department: OrganizationDepartment): void => {
    modal.confirm({
      title: t('departments.delete'),
      content: t('departments.deleteConfirm', { name: department.title }),
      okText: t('common.delete'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await state.deleteDepartment(department.id);
          message.success(t('notifications.departmentDeleted'));
          if (selectedDepartmentId === department.id) {
            setSelectedDepartmentId(null);
          }
        } catch (error) {
          showMutationError(error);
          throw error;
        }
      },
    });
  };

  const confirmRemoveEmployee = (employee: OrganizationEmployee, department: OrganizationDepartment): void => {
    modal.confirm({
      title: t('employees.remove'),
      content: t('employees.removeConfirm', { name: employee.nickname }),
      okText: t('employees.remove'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await state.removeEmployee(employee.id, department.id);
          message.success(t('notifications.employeeRemoved'));
        } catch (error) {
          showMutationError(error);
          throw error;
        }
      },
    });
  };

  const confirmTerminateEmployee = (employee: OrganizationEmployee): void => {
    modal.confirm({
      title: t('employees.terminate'),
      content: t('employees.terminateConfirm', { name: employee.nickname }),
      okText: t('employees.terminate'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await state.terminateEmployee(employee.id);
          message.success(t('notifications.employeeTerminated'));
          if (assignEmployee?.id === employee.id) {
            setAssignEmployee(null);
          }
          if (userDetails?.id === employee.id) {
            setUserDetails(null);
          }
          if (focusTarget?.employeeId === employee.id) {
            setFocusTarget(null);
          }
          setMembersDepartment(null);
        } catch (error) {
          showMutationError(error);
          throw error;
        }
      },
    });
  };

  const assignManagerDirectly = async (
    employee: OrganizationEmployee,
    department: OrganizationDepartment,
  ): Promise<void> => {
    try {
      await state.assignManager(department.id, employee.id);
      message.success(t('notifications.managerUpdated'));
    } catch (error) {
      showMutationError(error);
    }
  };

  if (!permissions.canViewDepartments) {
    return <Result status="403" title={t('errors.noDepartmentAccess')} />;
  }

  return (
    <div className="lc-org-page" style={{ background: token.colorBgLayout }}>
      <header className="lc-org-page__header" style={{ background: token.colorBgContainer }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('page.title')}
        </Typography.Title>
      </header>
      {state.structureLoading && state.departments.length === 0 ? (
        <div className="lc-org-page__loading" aria-label={t('common.loading')}>
          <Skeleton active paragraph={{ rows: 10 }} />
        </div>
      ) : state.structureError && state.departments.length === 0 ? (
        <Result
          status="error"
          title={state.structureError}
          extra={<Typography.Link onClick={async () => state.refreshAll()}>{t('common.retry')}</Typography.Link>}
        />
      ) : (
        <Flex className="lc-org-layout">
          <EmployeeSidebar
            collapsed={leftCollapsed}
            employees={permissions.canViewUsers ? state.employees : []}
            search={state.employeeSearch}
            filter={state.employeeFilter}
            loading={state.employeesLoading}
            error={permissions.canViewUsers ? state.employeesError : t('errors.noUserAccess')}
            hasMore={state.hasMoreEmployees}
            permissions={permissions}
            onCollapsedChange={setLeftCollapsed}
            onSearchChange={state.setEmployeeSearch}
            onFilterChange={state.setEmployeeFilter}
            onLoadMore={state.loadMoreEmployees}
            onLocate={locate}
            onAssign={setAssignEmployee}
            onOpen={setUserDetails}
            onTerminate={confirmTerminateEmployee}
            onCreate={() => setCreateEmployeeOpen(true)}
          />
          <OrganizationCanvas
            departments={state.departments}
            permissions={permissions}
            selectedDepartmentId={selectedDepartmentId}
            focusTarget={focusTarget}
            onSelect={locate}
            onCreateRoot={() => setDepartmentForm({ initialParentId: null })}
            onCreateChild={(department) => setDepartmentForm({ initialParentId: department.id })}
            onEdit={(department) => setDepartmentForm({ department, initialParentId: department.parentId })}
            onMove={setMoveDepartment}
            onDelete={confirmDeleteDepartment}
            onAssignManager={setManagerDepartment}
            onAddEmployees={setAddEmployeesDepartment}
            onShowMembers={setMembersDepartment}
            onOpenEmployee={setUserDetails}
            onMoveEmployee={setAssignEmployee}
            onRemoveEmployee={confirmRemoveEmployee}
            onTerminateEmployee={confirmTerminateEmployee}
            onMakeManager={assignManagerDirectly}
          />
          <DepartmentSidebar
            collapsed={rightCollapsed}
            departments={state.departments}
            selectedDepartmentId={selectedDepartmentId}
            onCollapsedChange={setRightCollapsed}
            onLocate={locate}
          />
        </Flex>
      )}

      <DepartmentFormModal
        open={Boolean(departmentForm)}
        loading={state.mutationLoading}
        service={state.service}
        departments={state.departments}
        department={departmentForm?.department}
        initialParentId={departmentForm?.initialParentId}
        canAssignManager={permissions.canAssignManager(departmentForm?.department?.id)}
        onClose={() => setDepartmentForm(null)}
        onSubmit={async (input) => {
          try {
            if (departmentForm?.department) {
              await state.updateDepartment(departmentForm.department.id, input.title, input.managerId);
              message.success(t('notifications.departmentUpdated'));
              locate(departmentForm.department.id);
            } else {
              const departmentId = await state.createDepartment(input);
              message.success(t('notifications.departmentCreated'));
              locate(departmentId);
            }
            setDepartmentForm(null);
          } catch (error) {
            showMutationError(error);
          }
        }}
      />
      <MoveDepartmentModal
        open={Boolean(moveDepartment)}
        loading={state.mutationLoading}
        department={moveDepartment}
        departments={state.departments}
        onClose={() => setMoveDepartment(null)}
        onSubmit={async (parentId) => {
          if (!moveDepartment) {
            return;
          }
          try {
            await state.moveDepartment(moveDepartment.id, parentId);
            message.success(t('notifications.departmentMoved'));
            locate(moveDepartment.id);
            setMoveDepartment(null);
          } catch (error) {
            showMutationError(error);
          }
        }}
      />
      <AssignEmployeeModal
        open={Boolean(assignEmployee)}
        loading={state.mutationLoading}
        employee={assignEmployee}
        departments={state.departments}
        onClose={() => setAssignEmployee(null)}
        onSubmit={async (departmentId, move) => {
          if (!assignEmployee) {
            return;
          }
          try {
            await state.assignEmployee(assignEmployee.id, departmentId, move);
            message.success(t(move ? 'notifications.employeeMoved' : 'notifications.employeeAssigned'));
            locate(departmentId, assignEmployee.id);
            setAssignEmployee(null);
          } catch (error) {
            showMutationError(error);
          }
        }}
      />
      <CreateEmployeeModal
        open={createEmployeeOpen}
        loading={state.mutationLoading}
        onClose={() => setCreateEmployeeOpen(false)}
        onSubmit={async (input) => {
          try {
            const passwordSetupEmailQueued = await state.createEmployee(input);
            setCreateEmployeeOpen(false);
            if (passwordSetupEmailQueued) {
              message.success(t('notifications.employeeCreated'));
            } else {
              message.warning(t('notifications.employeeCreatedEmailFailed'));
            }
          } catch (error) {
            showMutationError(error);
          }
        }}
      />
      <AddEmployeesModal
        open={Boolean(addEmployeesDepartment)}
        loading={state.mutationLoading}
        service={state.service}
        department={addEmployeesDepartment}
        onClose={() => setAddEmployeesDepartment(null)}
        onSubmit={async (employeeIds) => {
          if (!addEmployeesDepartment) {
            return;
          }
          try {
            await state.addEmployees(addEmployeesDepartment.id, employeeIds);
            message.success(t('notifications.employeesAdded'));
            setAddEmployeesDepartment(null);
          } catch (error) {
            showMutationError(error);
          }
        }}
      />
      <ManagerModal
        open={Boolean(managerDepartment)}
        loading={state.mutationLoading}
        service={state.service}
        department={managerDepartment}
        onClose={() => setManagerDepartment(null)}
        onSubmit={async (employeeId) => {
          if (!managerDepartment) {
            return;
          }
          try {
            await state.assignManager(managerDepartment.id, employeeId);
            message.success(t('notifications.managerUpdated'));
            setManagerDepartment(null);
          } catch (error) {
            showMutationError(error);
          }
        }}
      />
      <DepartmentMembersModal
        department={membersDepartment}
        permissions={permissions}
        onClose={() => setMembersDepartment(null)}
        onOpenEmployee={setUserDetails}
        onMoveEmployee={setAssignEmployee}
        onRemoveEmployee={(employee) => {
          if (membersDepartment) {
            confirmRemoveEmployee(employee, membersDepartment);
          }
        }}
        onTerminateEmployee={confirmTerminateEmployee}
        onMakeManager={(employee) => {
          if (membersDepartment) {
            assignManagerDirectly(employee, membersDepartment).catch(showMutationError);
          }
        }}
      />
      <UserDetailsModal employee={userDetails} onClose={() => setUserDetails(null)} />
    </div>
  );
}
