import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { boundaryViolation, frontendBoundary, importsOf, sourceFiles } from './architecture/imports';

const pluginsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(pluginsRoot, '../../..');
const configuration = ts.readConfigFile(path.join(repositoryRoot, 'tsconfig.json'), ts.sys.readFile);
const { options } = ts.parseJsonConfigFileContent(configuration.config, ts.sys, repositoryRoot);
const files = fs
  .readdirSync(pluginsRoot)
  .filter((name) => name.startsWith('plugin-'))
  .flatMap((name) => sourceFiles(path.join(pluginsRoot, name, 'src')));

function resolveImport(file: string, dependency: string): string {
  // Resolve Log Company package entry points to authoritative source, never installed/dist copies.
  const localPackage = dependency.match(/^@log-company\/(plugin-[^/]+)(?:\/(client|server))?$/);
  if (localPackage) {
    const directory = path.join(pluginsRoot, localPackage[1], 'src', localPackage[2] || 'server');
    return ['index.ts', 'index.tsx'].map((name) => path.join(directory, name)).find(fs.existsSync) || directory;
  }
  const resolved = ts.resolveModuleName(dependency, file, options, ts.sys).resolvedModule?.resolvedFileName;
  return resolved || (dependency.startsWith('.') ? path.resolve(path.dirname(file), dependency) : dependency);
}

describe('Log Company architecture', () => {
  it('enforces frontend/backend isolation, FSD public APIs and Onion dependencies', () => {
    const violations = files.flatMap((file) =>
      importsOf(fs.readFileSync(file, 'utf8'), file).flatMap((dependency) => {
        const violation = boundaryViolation(file, resolveImport(file, dependency), dependency);
        return violation ? [`${path.relative(pluginsRoot, file)} -> ${dependency}: ${violation}`] : [];
      }),
    );
    expect(violations).toEqual([]);
  });

  it('keeps frontend implementation inside named FSD layers with public APIs', () => {
    const violations = files
      .filter((file) => /\/src\/client(?:-v2)?\//.test(file))
      .flatMap((file) => {
        const boundary = frontendBoundary(file);
        if (!boundary) return /\/client(?:-v2)?\/index\.tsx?$/.test(file) ? [] : [file];
        return boundary.layer === 'app' || fs.existsSync(path.join(boundary.root, 'index.ts')) ? [] : [boundary.root];
      });
    expect([...new Set(violations)].map((file) => path.relative(pluginsRoot, file))).toEqual([]);
  });

  it('resolves every relative code import after file moves', () => {
    const violations = files.flatMap((file) =>
      importsOf(fs.readFileSync(file, 'utf8'), file)
        .filter((dependency) => dependency.startsWith('.') && !/\.(less|css|json|svg|png)$/.test(dependency))
        .filter((dependency) => !ts.resolveModuleName(dependency, file, options, ts.sys).resolvedModule)
        .map((dependency) => `${path.relative(pluginsRoot, file)} -> ${dependency}`),
    );
    expect(violations).toEqual([]);
  });
});
