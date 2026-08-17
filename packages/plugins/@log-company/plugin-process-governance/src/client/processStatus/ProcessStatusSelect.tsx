/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useField } from '@formily/react';
import {
  Select,
  type SelectProps,
  useAPIClient,
  useCollection,
  useCollectionField,
  useCurrentRoles,
} from '@nocobase/client';
import React from 'react';
import { resolveProcessStatusRoleNames } from '../../shared/processStatusPermissions';
import { isProcessStatusOption, isProcessStatusReadOnly, restrictProcessStatusOptions } from './processStatusOptions';

const PROCESS_COLLECTION = 'customs_processes';
const PROCESS_STATUS_FIELD = 'status';

interface FormFieldWithDataSource {
  dataSource?: unknown;
}

type ProcessStatusSelectComponent = React.FC<SelectProps> & {
  ReadPretty: typeof Select.ReadPretty;
};

const ProcessStatusSelectInternal: React.FC<SelectProps> = (props) => {
  const api = useAPIClient();
  const collection = useCollection();
  const collectionField = useCollectionField();
  const currentRoles = useCurrentRoles();
  const formField = useField<FormFieldWithDataSource>();

  if (collection?.name !== PROCESS_COLLECTION || collectionField?.name !== PROCESS_STATUS_FIELD) {
    return <Select {...props} />;
  }

  const roleNames = resolveProcessStatusRoleNames(
    api.auth.role,
    currentRoles.map((role) => role.name),
  );
  const rawOptions = Array.isArray(props.options)
    ? props.options
    : Array.isArray(formField.dataSource)
      ? formField.dataSource
      : [];
  const options = restrictProcessStatusOptions(rawOptions.filter(isProcessStatusOption), roleNames);

  return (
    <Select
      {...props}
      allowClear={false}
      disabled={props.disabled || isProcessStatusReadOnly(roleNames)}
      options={options}
    />
  );
};

export const ProcessStatusSelect = ProcessStatusSelectInternal as ProcessStatusSelectComponent;
ProcessStatusSelect.ReadPretty = Select.ReadPretty;
