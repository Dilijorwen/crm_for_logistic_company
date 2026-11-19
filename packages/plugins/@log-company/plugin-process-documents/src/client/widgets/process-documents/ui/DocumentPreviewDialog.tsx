/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Alert, Button, Empty, Modal, Select, Space, Spin } from 'antd';
import React, { useEffect, useState } from 'react';
import { canPreviewDocument, readDocumentPreview, type PreviewContent } from '../model/documentPreview';

export interface DocumentPreviewTarget {
  name: string;
  load(signal?: AbortSignal): Promise<Blob>;
}

export function downloadDocument(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function DocumentPreviewDialog({ file, onClose }: { file: DocumentPreviewTarget; onClose(): void }) {
  const [content, setContent] = useState<PreviewContent>();
  const [blob, setBlob] = useState<Blob>();
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  useEffect(() => {
    if (!canPreviewDocument(file.name)) {
      setContent({ kind: 'unsupported' });
      return;
    }
    const controller = new AbortController();
    async function load() {
      try {
        const data = await file.load(controller.signal);
        if (controller.signal.aborted) return;
        setBlob(data);
        const preview = await readDocumentPreview(file.name, data);
        if (!controller.signal.aborted) setContent(preview);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    load();
    return () => controller.abort();
  }, [file]);

  async function download() {
    setDownloading(true);
    setDownloadFailed(false);
    try {
      downloadDocument(blob ?? (await file.load()), file.name);
    } catch {
      setDownloadFailed(true);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal
      open
      title={file.name}
      width={1000}
      onCancel={onClose}
      footer={
        <Space>
          <Button loading={downloading} onClick={download}>
            Скачать
          </Button>
          <Button onClick={onClose}>Закрыть</Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {downloadFailed && <Alert type="error" showIcon message="Не удалось скачать файл." />}
        {error ? (
          <Alert type="warning" showIcon message="Не удалось показать содержимое. Попробуйте скачать файл." />
        ) : content ? (
          <PreviewBody name={file.name} content={content} />
        ) : (
          <Spin aria-label="Загрузка предпросмотра" />
        )}
      </Space>
    </Modal>
  );
}

function PreviewBody({ name, content }: { name: string; content: PreviewContent }) {
  if (content.kind === 'media') return <MediaPreview name={name} content={content} />;
  if (content.kind === 'table') return <SpreadsheetPreview sheets={content.sheets} />;
  if (content.kind === 'unsupported') {
    return <Alert type="info" showIcon message="Для этого формата нет предпросмотра. Файл можно скачать." />;
  }
  return (
    <>
      {content.limited && <Alert type="info" message="Показана часть файла. Скачайте файл целиком." />}
      {content.text ? (
        <pre
          style={{ margin: 0, maxHeight: '65vh', overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
        >
          {content.text}
        </pre>
      ) : (
        <Empty description="Нет текста для предпросмотра" />
      )}
    </>
  );
}

function MediaPreview({ name, content }: { name: string; content: Extract<PreviewContent, { kind: 'media' }> }) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const source = URL.createObjectURL(content.blob);
    setUrl(source);
    return () => URL.revokeObjectURL(source);
  }, [content.blob]);
  if (!url) return null;
  if (failed) return <Alert type="info" message="Браузер не смог открыть файл. Попробуйте скачать его." />;
  const onError = () => setFailed(true);
  if (content.mime.startsWith('image/')) {
    return <img src={url} alt={name} onError={onError} style={{ maxWidth: '100%', maxHeight: '65vh' }} />;
  }
  if (content.mime.startsWith('audio/')) return <audio aria-label={name} src={url} controls onError={onError} />;
  if (content.mime.startsWith('video/')) {
    return (
      <video aria-label={name} src={url} controls onError={onError} style={{ maxWidth: '100%', maxHeight: '65vh' }} />
    );
  }
  return (
    <object aria-label={name} data={url} type="application/pdf" style={{ width: '100%', height: '65vh' }}>
      Браузер не поддерживает просмотр PDF. Файл можно скачать.
    </object>
  );
}

function SpreadsheetPreview({ sheets }: { sheets: Extract<PreviewContent, { kind: 'table' }>['sheets'] }) {
  const [index, setIndex] = useState(0);
  const sheet = sheets[index];
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {sheets.length > 1 && (
        <Select
          aria-label="Лист Excel"
          value={index}
          onChange={setIndex}
          options={sheets.map(({ name }, index) => ({ value: index, label: name }))}
        />
      )}
      {sheet?.limited && <Alert type="info" message="Показана часть листа. Скачайте файл целиком." />}
      {sheet?.rows.length ? (
        <div style={{ overflow: 'auto', maxHeight: '60vh' }}>
          <table className="ant-table" aria-label={sheet.name}>
            <tbody className="ant-table-tbody">
              {sheet.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="ant-table-row">
                  {row.map((cell, colIndex) => (
                    <td key={colIndex} className="ant-table-cell">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty description="На листе нет данных" />
      )}
    </Space>
  );
}
