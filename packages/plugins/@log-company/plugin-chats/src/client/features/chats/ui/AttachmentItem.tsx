/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DownloadOutlined, FileOutlined, ExportOutlined } from '@ant-design/icons';
import { useAPIClient } from '@nocobase/client';
import { filePreviewTypes } from '@nocobase/plugin-file-manager/client';
import { App, Button, Flex, Image, Modal, Spin, Typography } from 'antd';
import React, { useState } from 'react';
import { downloadChatAttachment } from '../api/attachmentsApi';
import { errorMessage } from '../api/apiResponse';
import { useAttachmentPreview } from '../hooks/useAttachmentPreview';
import { attachmentPreviewKind } from '../lib/attachmentPreview';
import { formatFileSize } from '../lib/formatFileSize';
import type { ChatAttachment } from '../model/types';

export function AttachmentItem({ attachment }: { attachment: ChatAttachment }) {
  const kind = attachmentPreviewKind(attachment.mimeType);
  const preview = useAttachmentPreview(attachment.id, kind !== null && kind !== 'document');
  const api = useAPIClient();
  const { message } = App.useApp();
  const [downloading, setDownloading] = useState(false);
  const [open, setOpen] = useState(false);

  const download = async (): Promise<void> => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadChatAttachment(api, attachment.id, attachment.fileName);
    } catch (error) {
      message.error(errorMessage(error, 'Не удалось скачать вложение'));
    } finally {
      setDownloading(false);
    }
  };

  const previewFile = {
    url: preview.url,
    filename: attachment.fileName,
    title: attachment.fileName,
    mimetype: attachment.mimeType,
  };
  const PdfPreviewer =
    attachment.mimeType === 'application/pdf' ? filePreviewTypes.getTypeByFile(previewFile)?.Previewer : undefined;
  const documentContent = preview.url ? (
    PdfPreviewer ? (
      <div style={{ height: '70vh', overflowY: 'auto' }}>
        <PdfPreviewer file={previewFile} index={0} list={[previewFile]} onDownload={download} />
      </div>
    ) : (
      <iframe title={attachment.fileName} src={preview.url} style={{ width: '100%', height: '70vh', border: 0 }} />
    )
  ) : preview.loading ? (
    <Spin aria-label="Загрузка вложения" />
  ) : null;

  return (
    <div ref={preview.containerRef} style={{ maxWidth: '100%', marginBlock: 4 }}>
      {kind === 'image' && preview.url ? (
        <Image
          src={preview.url}
          alt={attachment.fileName}
          width={280}
          style={{ maxWidth: '100%', maxHeight: 320, objectFit: 'contain' }}
        />
      ) : null}
      {kind === 'video' && preview.url ? (
        <video
          src={preview.url}
          controls
          preload="metadata"
          aria-label={attachment.fileName}
          style={{ width: 320, maxWidth: '100%' }}
        />
      ) : null}
      {kind === 'audio' && preview.url ? (
        <audio
          src={preview.url}
          controls
          preload="metadata"
          aria-label={attachment.fileName}
          style={{ maxWidth: '100%' }}
        />
      ) : null}
      {kind !== 'document' && preview.loading ? <Spin size="small" aria-label="Загрузка вложения" /> : null}
      {preview.error ? (
        <Flex gap={4} align="center">
          <Typography.Text type="secondary">Не удалось открыть вложение</Typography.Text>
          <Button size="small" onClick={preview.request}>
            Повторить
          </Button>
        </Flex>
      ) : null}
      <Flex gap={4} align="center" wrap>
        <FileOutlined />
        <Typography.Text style={{ overflowWrap: 'anywhere' }}>
          {attachment.fileName} · {formatFileSize(attachment.size)}
        </Typography.Text>
        {kind === 'document' ? (
          <Button
            size="small"
            type="link"
            onClick={() => {
              preview.request();
              setOpen(true);
            }}
          >
            Открыть
          </Button>
        ) : null}
        <Button
          type="text"
          size="small"
          icon={<DownloadOutlined />}
          loading={downloading}
          onClick={download}
          aria-label={`Скачать ${attachment.fileName}`}
        />
      </Flex>
      <Modal
        open={open}
        destroyOnClose
        onCancel={() => setOpen(false)}
        title={attachment.fileName}
        width="min(1000px, 95vw)"
        footer={
          preview.url ? (
            <a href={preview.url} target="_blank" rel="noopener noreferrer">
              <ExportOutlined /> Открыть в новой вкладке
            </a>
          ) : null
        }
      >
        {documentContent}
        {preview.error ? <Button onClick={preview.request}>Повторить загрузку</Button> : null}
      </Modal>
    </div>
  );
}
