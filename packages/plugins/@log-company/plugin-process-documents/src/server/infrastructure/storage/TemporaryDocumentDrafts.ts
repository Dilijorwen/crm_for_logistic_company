/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { processDocumentUpload, validateUploadBatch } from '@log-company/plugin-file-storage';
import type { FormDocumentSaveTarget } from '../../../contracts/processDocuments';
import type { UploadedDocumentFile } from '../../application/UploadProcessDocuments';
import { ProcessDocumentsError } from '../../domain/documents/DocumentErrors';

const lifetime = 2 * 60 * 60 * 1_000;
const concurrentUploads = 4;
const maximumStagedBytes = 8 * processDocumentUpload.maxTotalBytes;
const maximumBatches = 100;
interface Draft {
  actor: string;
  form: FormDocumentSaveTarget;
  directory: string;
  files: UploadedDocumentFile[];
  expires: number;
  active?: boolean;
  discarded?: boolean;
}

export class TemporaryDocumentDrafts {
  private readonly drafts = new Map<string, Draft>();
  private readonly staging = new Set<string>();
  private readonly busyDirectories = new Set<string>();
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly root: string, private readonly reportError: (error: unknown) => void) {}

  async start(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const directory = await lstat(this.root);
    if (!directory.isDirectory() || directory.uid !== process.getuid?.() || (directory.mode & 0o077)) {
      throw new Error('Временная папка документов должна быть доступна только серверу.');
    }
    await this.cleanExpired();
    this.timer = setInterval(() => this.cleanExpired().catch(this.reportError), 5 * 60 * 1000);
    this.timer.unref();
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async stage(
    actor: string,
    form: FormDocumentSaveTarget,
    receive: (directory: string) => Promise<UploadedDocumentFile[]>,
  ) {
    if (this.staging.has(actor) || this.staging.size >= concurrentUploads || this.drafts.size >= maximumBatches) {
      throw new ProcessDocumentsError('FORM_DRAFT_BUSY', 'Дождитесь окончания предыдущей загрузки.');
    }
    this.staging.add(actor);
    let directory: string | undefined;
    let retained = false;
    try {
      directory = await mkdtemp(path.join(this.root, 'batch-'));
      this.busyDirectories.add(directory);
      const files = await receive(directory);
      if (!files.length) throw new ProcessDocumentsError('FILES_REQUIRED', 'Файлы не выбраны.');
      const existing = [...this.drafts.values()];
      validateUploadBatch([...existing.filter((draft) => draft.actor === actor).flatMap((draft) => draft.files), ...files],
        processDocumentUpload);
      if ([...existing.flatMap((draft) => draft.files), ...files].reduce((sum, item) => sum + item.size, 0) > maximumStagedBytes) {
        throw new ProcessDocumentsError('FORM_DRAFT_BUSY', 'Временное хранилище занято. Повторите позже.');
      }
      const token = randomUUID();
      this.drafts.set(token, { actor, form, directory, files, expires: Date.now() + lifetime });
      retained = true;
      return { token, files: files.map(({ originalName, size }) => ({ name: originalName, size })) };
    } finally {
      this.staging.delete(actor);
      if (directory) {
        this.busyDirectories.delete(directory);
        if (!retained) await this.remove(directory);
      }
    }
  }

  acquire(tokens: string[], actor: string, form: FormDocumentSaveTarget) {
    const drafts = tokens.map((token) => {
      const draft = this.drafts.get(token);
      if (!draft || draft.expires <= Date.now()) throw expired();
      if (draft.actor !== actor || draft.form.resource !== form.resource || draft.form.recordId !== form.recordId) {
        throw new ProcessDocumentsError('DRAFT_ACCESS_DENIED', 'Временные файлы принадлежат другой форме.');
      }
      if (draft.active) throw new ProcessDocumentsError('FORM_DRAFT_BUSY', 'Файлы уже сохраняются.');
      return draft;
    });
    drafts.forEach((draft) => { draft.active = true; });
    return {
      files: drafts.flatMap((draft) => draft.files),
      release: async (saved = false) => {
        await Promise.all(tokens.map(async (token, index) => {
          const draft = drafts[index];
          if (saved || draft.discarded) {
            this.drafts.delete(token);
            await this.remove(draft.directory);
          } else draft.active = false;
        }));
      },
    };
  }

  async discard(tokens: string[], actor: string): Promise<void> {
    const batches = tokens.map((token) => this.drafts.get(token));
    if (batches.some((draft) => draft && draft.actor !== actor)) {
      throw new ProcessDocumentsError('DRAFT_ACCESS_DENIED', 'Нет доступа к временным файлам.');
    }
    await Promise.all(tokens.map(async (token, index) => {
      const draft = batches[index];
      if (!draft) return;
      if (draft.active) draft.discarded = true;
      else {
        this.drafts.delete(token);
        await this.remove(draft.directory);
      }
    }));
  }

  private async cleanExpired(): Promise<void> {
    const cutoff = Date.now();
    for (const [token, draft] of this.drafts) {
      if (!draft.active && draft.expires <= cutoff) await this.discard([token], draft.actor);
    }
    const tracked = new Set([...this.drafts.values()].map((draft) => draft.directory));
    for (const entry of await readdir(this.root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^batch-[A-Za-z0-9]{6}$/.test(entry.name)) continue;
      const directory = path.join(this.root, entry.name);
      if (tracked.has(directory) || this.busyDirectories.has(directory)) continue;
      try {
        if ((await lstat(directory)).mtimeMs <= cutoff - lifetime) await this.remove(directory);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  }

  private async remove(directory: string): Promise<void> {
    await rm(directory, { recursive: true, force: true }).catch(this.reportError);
  }
}

function expired() {
  return new ProcessDocumentsError('FORM_DRAFT_EXPIRED', 'Временные файлы недоступны. Очистите черновик и добавьте их снова.');
}
