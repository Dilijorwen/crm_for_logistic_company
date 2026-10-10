/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NodeFileTypeDetector } from '../NodeFileTypeDetector';

describe('NodeFileTypeDetector', () => {
  let directory: string;
  const detector = new NodeFileTypeDetector();

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-file-type-test-'));
  });

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('scans the whole text file instead of trusting only its prefix', async () => {
    const filePath = path.join(directory, 'invalid.txt');
    await fs.writeFile(filePath, Buffer.concat([Buffer.alloc(70_000, 0x61), Buffer.from([0xff])]));

    await expect(detector.detect(filePath, 'invalid.txt')).resolves.toBe('application/octet-stream');
  });

  it('accepts valid UTF-8 text', async () => {
    const filePath = path.join(directory, 'note.txt');
    await fs.writeFile(filePath, 'Документ CRM', 'utf8');

    await expect(detector.detect(filePath, 'note.txt')).resolves.toBe('text/plain');
  });

  it('does not accept an arbitrary ZIP archive renamed to DOCX', async () => {
    const filePath = path.join(directory, 'fake.docx');
    await fs.writeFile(filePath, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]));

    await expect(detector.detect(filePath, 'fake.docx')).resolves.toBe('application/octet-stream');
  });

  it.each([
    ['video.mp4', Buffer.from('000000186674797069736f6d0000000069736f6d6d703432', 'hex'), 'video/mp4'],
    ['photo.avif', Buffer.from('00000018667479706176696600000000617669666d696631', 'hex'), 'image/avif'],
    ['sound.wav', Buffer.from('RIFF0000WAVEfmt '), 'audio/wav'],
    ['sound.mp3', Buffer.from('ID3\u0004\u0000\u0000'), 'audio/mpeg'],
    ['sound.ogg', Buffer.from('OggS\u0000\u0002'), 'audio/ogg'],
    ['video.webm', Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from('webm')]), 'video/webm'],
  ])('recognizes %s by its contents', async (filename, contents, mimeType) => {
    const filePath = path.join(directory, filename);
    await fs.writeFile(filePath, contents);
    await expect(detector.detect(filePath, filename)).resolves.toBe(mimeType);
  });

  it('does not trust a video extension without its signature', async () => {
    const filePath = path.join(directory, 'fake.mp4');
    await fs.writeFile(filePath, '<html>not a video</html>');
    await expect(detector.detect(filePath, 'fake.mp4')).resolves.toBe('application/octet-stream');
  });
});
