/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DownOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Dropdown, Input, Modal, Typography, message } from 'antd';
import React from 'react';
import { blockClass, useDocumentsTheme } from './styles';

export function DocumentBrowser({ title, children }: { title?: string; children: React.ReactNode }) {
  const themeStyle = useDocumentsTheme();
  return (
    <div className={`${blockClass} process-documents-scroll`} style={themeStyle}>
      <div className="process-documents-shell">
        {title && (
          <Typography.Title level={5} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
        )}
        {children}
      </div>
    </div>
  );
}

export function DocumentUploadMenu({
  busy,
  disabled,
  fileInput,
  folderInput,
  createFolder,
}: {
  busy: boolean;
  disabled?: boolean;
  fileInput: React.RefObject<HTMLInputElement>;
  folderInput: React.RefObject<HTMLInputElement>;
  createFolder?: () => void;
}) {
  return (
    <>
      <Dropdown
        disabled={disabled}
        trigger={['click']}
        menu={{
          items: [
            { key: 'files', label: 'Файлы' },
            { key: 'folder', label: 'Папку' },
          ],
          onClick: ({ key }) => (key === 'folder' ? folderInput : fileInput).current?.click(),
        }}
      >
        <Button icon={<UploadOutlined />} loading={busy} disabled={disabled}>
          Загрузить <DownOutlined />
        </Button>
      </Dropdown>
      {createFolder && (
        <Button disabled={busy || disabled} onClick={createFolder}>
          Новая папка
        </Button>
      )}
    </>
  );
}

export function openDocumentFolderDialog(
  modal: ReturnType<typeof Modal.useModal>[0],
  create: (name: string) => Promise<void>,
) {
  let name = '';
  modal.confirm({
    title: 'Новая папка',
    content: (
      <Input
        aria-label="Название папки"
        autoFocus
        maxLength={200}
        onChange={(event) => {
          name = event.target.value;
        }}
      />
    ),
    okText: 'Создать',
    cancelText: 'Отмена',
    onOk: async () => {
      if (!name.trim() || /[/\\]/.test(name) || ['.', '..'].includes(name.trim())) {
        message.warning('Укажите допустимое название папки.');
        throw new Error('Недопустимое название папки');
      }
      await create(name.trim());
    },
  });
}
