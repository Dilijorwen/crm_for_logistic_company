import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pluginsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const importPattern = /(?:import|export)\s+(?:[^'\"]+\s+from\s+)?['\"]([^'\"]+)['\"]/g;

function sourceFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sourceFiles(entryPath);
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [entryPath] : [];
  });
}

function importsOf(file: string): string[] {
  return Array.from(fs.readFileSync(file, 'utf8').matchAll(importPattern), (match) => match[1]);
}

function layerFiles(layer: string): string[] {
  return fs
    .readdirSync(pluginsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('plugin-'))
    .flatMap((entry) => sourceFiles(path.join(pluginsRoot, entry.name, 'src', 'server', layer)));
}

function relativeToPlugins(file: string): string {
  return path.relative(pluginsRoot, file);
}

describe('Onion architecture boundaries', () => {
  it('keeps domain code independent from frameworks and outer layers', () => {
    const violations = layerFiles('domain').flatMap((file) =>
      importsOf(file)
        .filter(
          (dependency) =>
            !dependency.startsWith('.') ||
            /(?:^|\/)(application|infrastructure|interfaces|composition)(?:\/|$)/.test(dependency),
        )
        .map((dependency) => `${relativeToPlugins(file)} -> ${dependency}`),
    );

    expect(violations).toEqual([]);
  });

  it('keeps application code independent from frameworks and adapters', () => {
    const violations = layerFiles('application').flatMap((file) =>
      importsOf(file)
        .filter(
          (dependency) =>
            dependency.startsWith('@nocobase/') ||
            /(?:^|\/)(infrastructure|interfaces|composition)(?:\/|$)/.test(dependency),
        )
        .map((dependency) => `${relativeToPlugins(file)} -> ${dependency}`),
    );

    expect(violations).toEqual([]);
  });

  it('prevents adapters from depending on delivery and composition layers', () => {
    const violations = layerFiles('infrastructure').flatMap((file) =>
      importsOf(file)
        .filter((dependency) => /(?:^|\/)(interfaces|composition)(?:\/|$)/.test(dependency))
        .map((dependency) => `${relativeToPlugins(file)} -> ${dependency}`),
    );

    expect(violations).toEqual([]);
  });
});
