/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useEffect, useState } from 'react';
import type { OrganizationStructureService } from '../api/organizationStructureService';
import type { OrganizationEmployee } from '../model/types';

const SEARCH_DEBOUNCE_MS = 300;

export function useRemoteEmployeeOptions(service: OrganizationStructureService, open: boolean) {
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<OrganizationEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setEmployees([]);
      setFailed(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setFailed(false);
      service
        .searchEmployees(search)
        .then((result) => {
          if (active) {
            setEmployees(result);
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) {
            setEmployees([]);
            setFailed(true);
            setLoading(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, search, service]);

  return { search, setSearch, employees, loading, failed };
}
