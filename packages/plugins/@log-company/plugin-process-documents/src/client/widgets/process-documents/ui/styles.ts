/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { theme } from 'antd';
import { css } from '@nocobase/client';
import type { CSSProperties } from 'react';

export const blockClass = css`
  &.process-documents-scroll {
    min-height: 320px;
    max-height: 680px;
    overflow: auto;
  }

  &.process-documents-scroll:has(.process-documents-form-controls) {
    min-height: 0;
  }

  .process-documents-shell {
    display: grid;
    gap: 12px;
  }

  .process-documents-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
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
    container-type: inline-size;
    border: 1px solid var(--process-documents-border);
    border-radius: 6px;
    background: var(--process-documents-bg);
    overflow: hidden;
  }

  .process-documents-list-dragging {
    border-color: var(--process-documents-primary);
    box-shadow: inset 0 0 0 1px var(--process-documents-primary);
  }

  .process-documents-form-controls {
    display: grid;
    gap: 8px;
    padding: 10px;
    border-bottom: 1px solid var(--process-documents-border-secondary);
  }

  .process-documents-form-hint {
    color: var(--process-documents-text-secondary);
    font-size: 13px;
  }

  .process-documents-draft-files {
    margin: 0;
    padding-inline-start: 20px;
    overflow-wrap: anywhere;
  }

  .process-documents-row {
    display: grid;
    grid-template-columns: minmax(150px, 1fr) 60px 75px 125px minmax(90px, 120px) 68px;
    gap: 12px;
    align-items: center;
    min-height: 44px;
    padding: 7px 10px;
    border-bottom: 1px solid var(--process-documents-border-secondary);
    background: var(--process-documents-bg);
    transition: background-color 0.15s ease;
  }

  .process-documents-list-search .process-documents-row {
    grid-template-columns: minmax(100px, 1fr) minmax(140px, 1.6fr) 44px 65px 116px 94px 30px;
  }

  .process-documents-file-location.ant-btn {
    justify-content: flex-start;
    padding: 0;
    height: auto;
    white-space: normal;
    text-align: start;
    overflow-wrap: anywhere;
  }

  .process-documents-row:hover {
    background: var(--process-documents-row-hover);
  }

  .process-documents-row.process-documents-row-drop-target {
    background: var(--process-documents-row-hover);
    box-shadow: inset 0 0 0 1px var(--process-documents-primary);
  }

  .process-documents-columns {
    font-weight: 500;
    color: var(--process-documents-text-secondary);
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

  .process-documents-name .anticon {
    font-size: 21px;
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

  @container (max-width: 760px) {
    .process-documents-list-search .process-documents-row {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) auto;
      gap: 8px;
    }

    .process-documents-list-search .process-documents-meta {
      display: none;
    }
  }

  @container (max-width: 640px) {
    .process-documents-row {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px;
    }

    .process-documents-meta {
      display: none;
    }
  }
`;

export function useDocumentsTheme(): CSSProperties {
  const { token } = theme.useToken();
  return {
    '--process-documents-border': token.colorBorder,
    '--process-documents-border-secondary': token.colorBorderSecondary,
    '--process-documents-bg': token.colorBgContainer,
    '--process-documents-primary': token.colorPrimary,
    '--process-documents-row-hover': token.colorBgTextHover,
    '--process-documents-text': token.colorText,
    '--process-documents-text-secondary': token.colorTextSecondary,
  } as CSSProperties;
}
