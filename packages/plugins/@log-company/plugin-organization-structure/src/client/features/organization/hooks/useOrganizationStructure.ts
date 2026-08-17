/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useAPIClient } from '@nocobase/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOrganizationTranslation } from '../../../locale';
import { apiErrorMessage } from '../api/apiResponse';
import { OrganizationStructureService } from '../api/organizationStructureService';
import type {
  CreateEmployeeInput,
  DepartmentMutationInput,
  EmployeeFilter,
  EmployeeQuery,
  Identifier,
  OrganizationDepartment,
  OrganizationEmployee,
} from '../model/types';

const EMPLOYEE_PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

export interface OrganizationStructureState {
  departments: OrganizationDepartment[];
  employees: OrganizationEmployee[];
  structureLoading: boolean;
  employeesLoading: boolean;
  mutationLoading: boolean;
  structureError: string | null;
  employeesError: string | null;
  employeeSearch: string;
  employeeFilter: EmployeeFilter;
  hasMoreEmployees: boolean;
  service: OrganizationStructureService;
  setEmployeeSearch: (value: string) => void;
  setEmployeeFilter: (value: EmployeeFilter) => void;
  loadMoreEmployees: () => Promise<void>;
  refreshAll: () => Promise<void>;
  createEmployee: (input: CreateEmployeeInput) => Promise<boolean>;
  createDepartment: (input: DepartmentMutationInput) => Promise<Identifier>;
  updateDepartment: (departmentId: Identifier, title: string, managerId: Identifier | null) => Promise<void>;
  moveDepartment: (departmentId: Identifier, parentId: Identifier | null) => Promise<void>;
  deleteDepartment: (departmentId: Identifier) => Promise<void>;
  assignEmployee: (employeeId: Identifier, departmentId: Identifier, move: boolean) => Promise<void>;
  removeEmployee: (employeeId: Identifier, departmentId: Identifier) => Promise<void>;
  terminateEmployee: (employeeId: Identifier) => Promise<void>;
  addEmployees: (departmentId: Identifier, employeeIds: Identifier[]) => Promise<void>;
  assignManager: (departmentId: Identifier, employeeId: Identifier | null) => Promise<void>;
}

export function useOrganizationStructure(): OrganizationStructureState {
  const api = useAPIClient();
  const { t } = useOrganizationTranslation();
  const service = useMemo(() => new OrganizationStructureService(api), [api]);
  const [departments, setDepartments] = useState<OrganizationDepartment[]>([]);
  const [employees, setEmployees] = useState<OrganizationEmployee[]>([]);
  const [structureLoading, setStructureLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [mutationLoading, setMutationLoading] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilter>('all');
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeTotalPages, setEmployeeTotalPages] = useState(1);
  const employeeRequestSequence = useRef(0);

  const loadStructure = useCallback(async (): Promise<void> => {
    setStructureLoading(true);
    setStructureError(null);
    try {
      setDepartments(await service.getStructure());
    } catch (error) {
      setStructureError(apiErrorMessage(error, t('errors.loadStructure')));
    } finally {
      setStructureLoading(false);
    }
  }, [service, t]);

  const loadEmployees = useCallback(
    async (query: EmployeeQuery, append: boolean): Promise<void> => {
      const requestSequence = employeeRequestSequence.current + 1;
      employeeRequestSequence.current = requestSequence;
      setEmployeesLoading(true);
      setEmployeesError(null);
      try {
        const result = await service.getEmployees(query);
        if (employeeRequestSequence.current !== requestSequence) {
          return;
        }
        setEmployees((current) => (append ? [...current, ...result.items] : result.items));
        setEmployeePage(result.page);
        setEmployeeTotalPages(result.totalPages);
      } catch (error) {
        if (employeeRequestSequence.current === requestSequence) {
          setEmployeesError(apiErrorMessage(error, t('errors.loadEmployees')));
        }
      } finally {
        if (employeeRequestSequence.current === requestSequence) {
          setEmployeesLoading(false);
        }
      }
    },
    [service, t],
  );

  useEffect(() => {
    loadStructure().catch((error: unknown) => setStructureError(apiErrorMessage(error, t('errors.loadStructure'))));
  }, [loadStructure, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadEmployees(
        { search: employeeSearch, filter: employeeFilter, page: 1, pageSize: EMPLOYEE_PAGE_SIZE },
        false,
      ).catch((error: unknown) => setEmployeesError(apiErrorMessage(error, t('errors.loadEmployees'))));
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [employeeFilter, employeeSearch, loadEmployees, t]);

  const refreshAll = useCallback(async (): Promise<void> => {
    await Promise.all([
      loadStructure(),
      loadEmployees({ search: employeeSearch, filter: employeeFilter, page: 1, pageSize: EMPLOYEE_PAGE_SIZE }, false),
    ]);
  }, [employeeFilter, employeeSearch, loadEmployees, loadStructure]);

  const refreshAfterMutation = useCallback(
    async (operation: () => Promise<void>): Promise<void> => {
      setMutationLoading(true);
      try {
        await operation();
        await refreshAll();
      } catch (error) {
        await refreshAll();
        throw error;
      } finally {
        setMutationLoading(false);
      }
    },
    [refreshAll],
  );

  const createDepartment = useCallback(
    async (input: DepartmentMutationInput): Promise<Identifier> => {
      setMutationLoading(true);
      try {
        const departmentId = await service.createDepartment(input);
        await refreshAll();
        return departmentId;
      } catch (error) {
        await refreshAll();
        throw error;
      } finally {
        setMutationLoading(false);
      }
    },
    [refreshAll, service],
  );

  const createEmployee = useCallback(
    async (input: CreateEmployeeInput): Promise<boolean> => {
      setMutationLoading(true);
      try {
        const result = await service.createEmployee(input, window.location.origin);
        await refreshAll();
        return result.passwordSetupEmailQueued;
      } catch (error) {
        await refreshAll();
        throw error;
      } finally {
        setMutationLoading(false);
      }
    },
    [refreshAll, service],
  );

  const updateDepartment = useCallback(
    async (departmentId: Identifier, title: string, managerId: Identifier | null): Promise<void> => {
      await refreshAfterMutation(async () => {
        const department = departments.find((item) => item.id === departmentId);
        const currentManagerId = department?.owners[0]?.id || null;
        await service.updateDepartment(departmentId, title, currentManagerId === managerId ? undefined : managerId);
      });
    },
    [departments, refreshAfterMutation, service],
  );

  const moveDepartment = useCallback(
    async (departmentId: Identifier, parentId: Identifier | null): Promise<void> =>
      refreshAfterMutation(() => service.moveDepartment(departmentId, parentId)),
    [refreshAfterMutation, service],
  );

  const deleteDepartment = useCallback(
    async (departmentId: Identifier): Promise<void> =>
      refreshAfterMutation(() => service.deleteDepartment(departmentId)),
    [refreshAfterMutation, service],
  );

  const assignEmployee = useCallback(
    async (employeeId: Identifier, departmentId: Identifier, move: boolean): Promise<void> =>
      refreshAfterMutation(() =>
        move ? service.moveEmployee(employeeId, departmentId) : service.assignEmployee(employeeId, departmentId),
      ),
    [refreshAfterMutation, service],
  );

  const removeEmployee = useCallback(
    async (employeeId: Identifier, departmentId: Identifier): Promise<void> =>
      refreshAfterMutation(() => service.removeEmployee(employeeId, departmentId)),
    [refreshAfterMutation, service],
  );

  const terminateEmployee = useCallback(
    async (employeeId: Identifier): Promise<void> => refreshAfterMutation(() => service.terminateEmployee(employeeId)),
    [refreshAfterMutation, service],
  );

  const addEmployees = useCallback(
    async (departmentId: Identifier, employeeIds: Identifier[]): Promise<void> =>
      refreshAfterMutation(() => service.addEmployees(departmentId, employeeIds)),
    [refreshAfterMutation, service],
  );

  const assignManager = useCallback(
    async (departmentId: Identifier, employeeId: Identifier | null): Promise<void> =>
      refreshAfterMutation(() =>
        employeeId ? service.assignManager(departmentId, employeeId) : service.removeManagers(departmentId),
      ),
    [refreshAfterMutation, service],
  );

  const loadMoreEmployees = useCallback(async (): Promise<void> => {
    if (employeesLoading || employeePage >= employeeTotalPages) {
      return;
    }
    await loadEmployees(
      {
        search: employeeSearch,
        filter: employeeFilter,
        page: employeePage + 1,
        pageSize: EMPLOYEE_PAGE_SIZE,
      },
      true,
    );
  }, [employeeFilter, employeePage, employeeSearch, employeeTotalPages, employeesLoading, loadEmployees]);

  return {
    departments,
    employees,
    structureLoading,
    employeesLoading,
    mutationLoading,
    structureError,
    employeesError,
    employeeSearch,
    employeeFilter,
    hasMoreEmployees: employeePage < employeeTotalPages,
    service,
    setEmployeeSearch,
    setEmployeeFilter,
    loadMoreEmployees,
    refreshAll,
    createEmployee,
    createDepartment,
    updateDepartment,
    moveDepartment,
    deleteDepartment,
    assignEmployee,
    removeEmployee,
    terminateEmployee,
    addEmployees,
    assignManager,
  };
}
