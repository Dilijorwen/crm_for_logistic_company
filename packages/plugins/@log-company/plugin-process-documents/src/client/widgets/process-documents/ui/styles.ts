/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { css } from '@nocobase/client';

export const blockClass = css`
  min-height: 320px;
  max-height: 680px;
  overflow: auto;

  .process-documents-shell {
    display: grid;
    gap: 12px;
  }

  .process-documents-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .process-documents-breadcrumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    color: var(--process-documents-text-secondary);
    font-size: 13px;
  }

  .process-documents-crumb {
    color: var(--process-documents-primary);
    border: 0;
    padding: 0;
    height: auto;
  }

  .process-documents-list {
    border: 1px solid var(--process-documents-border);
    border-radius: 6px;
    background: var(--process-documents-bg);
    overflow: hidden;
  }

  .process-documents-row {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) 110px 160px minmax(100px, 140px) auto;
    gap: 12px;
    align-items: center;
    min-height: 44px;
    padding: 7px 10px;
    border-bottom: 1px solid var(--process-documents-border-secondary);
    background: var(--process-documents-bg);
    transition: background-color 0.15s ease;
  }

  .process-documents-row:hover {
    background: var(--process-documents-row-hover);
  }

  .process-documents-row:last-child {
    border-bottom: 0;
  }

  .process-documents-name {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    gap: 8px;
    color: var(--process-documents-text);
  }

  button.process-documents-name {
    width: 100%;
    border: 0;
    background: transparent;
    padding: 0;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  button.process-documents-name:hover {
    color: var(--process-documents-primary);
  }

  .process-documents-name-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .process-documents-meta {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--process-documents-text-secondary);
    font-size: 12px;
  }

  .process-documents-actions {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
  }

  @media (max-width: 760px) {
    .process-documents-row {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px;
    }

    .process-documents-meta {
      display: none;
    }
  }
`;
