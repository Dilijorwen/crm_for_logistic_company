/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Select } from 'antd';
import React, { useMemo } from 'react';
import { useOrganizationTranslation } from '../../../locale';
import type { OrganizationStructureService } from '../api/organizationStructureService';
import { useRemoteEmployeeOptions } from '../hooks/useRemoteEmployeeOptions';
import type { Identifier, OrganizationEmployee } from '../model/types';

interface RemoteEmployeeSelectProps {
  open: boolean;
  service: OrganizationStructureService;
  value?: Identifier | Identifier[] | null;
  multiple?: boolean;
  currentEmployees?: OrganizationEmployee[];
  onChange?: (value: Identifier | Identifier[] | null) => void;
}

export function RemoteEmployeeSelect(props: RemoteEmployeeSelectProps) {
  const { t } = useOrganizationTranslation();
  const { setSearch, employees, loading, failed } = useRemoteEmployeeOptions(props.service, props.open);
  const options = useMemo(() => {
    const byId = new Map<Identifier, OrganizationEmployee>();
    for (const employee of [...(props.currentEmployees || []), ...employees]) {
      byId.set(employee.id, employee);
    }
    return [...byId.values()].map((employee) => ({ value: employee.id, label: employee.nickname }));
  }, [employees, props.currentEmployees]);
  return (
    <Select
      showSearch
      allowClear
      mode={props.multiple ? 'multiple' : undefined}
      value={props.value ?? undefined}
      options={options}
      loading={loading}
      status={failed ? 'error' : undefined}
      notFoundContent={failed ? t('errors.loadEmployees') : undefined}
      filterOption={false}
      placeholder={t('validation.employeeRequired')}
      aria-label={t('validation.employeeRequired')}
      onSearch={setSearch}
      onChange={(value) => props.onChange?.(value ?? null)}
    />
  );
}
