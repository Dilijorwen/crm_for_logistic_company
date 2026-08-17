/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import fg from 'fast-glob';
import path from 'path';
import ts from 'typescript';

import { PACKAGES_PATH, ROOT_PATH } from './constant';

const INCLUDE_PATTERNS = ['**/*.{ts,tsx}'];
const EXCLUDE_PATTERNS = [
  '**/fixtures{,/**}',
  '**/demos{,/**}',
  '**/__test__{,/**}',
  '**/__tests__{,/**}',
  '**/__benchmarks__{,/**}',
  '**/__e2e__{,/**}',
  '**/*.mdx',
  '**/*.md',
  '**/*.+(test|e2e|spec).+(js|jsx|ts|tsx)',
  '**/tsconfig{,.*}.json',
  '.umi{,-production,-test}{,/**}',
];

const diagnosticHost: ts.FormatDiagnosticsHost = {
  getCurrentDirectory: () => process.cwd(),
  getCanonicalFileName: (fileName) => (ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase()),
  getNewLine: () => ts.sys.newLine,
};

function loadCompilerOptions(): ts.CompilerOptions {
  const configPath = path.join(ROOT_PATH, 'tsconfig.json');
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext([configFile.error], diagnosticHost));
  }
  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath,
  );
  return parsedConfig.options;
}

function isPathInside(parentPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(parentPath, candidatePath);
  return (
    relativePath === '' ||
    (!relativePath.startsWith(`..${path.sep}`) && relativePath !== '..' && !path.isAbsolute(relativePath))
  );
}

function isWorkspaceDependencyRootDirDiagnostic(diagnostic: ts.Diagnostic, packagePath: string): boolean {
  if (diagnostic.code !== 6059) {
    return false;
  }

  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  const fileMatch = message.match(/^File '([^']+)' is not under 'rootDir'/);
  if (!fileMatch) {
    return false;
  }

  const referencedFile = path.resolve(fileMatch[1]);
  return isPathInside(PACKAGES_PATH, referencedFile) && !isPathInside(packagePath, referencedFile);
}

export const buildDeclaration = async (cwd: string, targetDir: string) => {
  const srcPath = path.join(cwd, 'src');
  const targetPath = path.join(cwd, targetDir);
  const files = await fg(INCLUDE_PATTERNS, {
    cwd: srcPath,
    ignore: EXCLUDE_PATTERNS,
    absolute: true,
    dot: true,
  });

  if (!files.length) {
    return;
  }

  const compilerOptions = {
    ...loadCompilerOptions(),
    declaration: true,
    emitDeclarationOnly: true,
    declarationDir: targetPath,
    outDir: targetPath,
    rootDir: srcPath,
  } satisfies ts.CompilerOptions;

  const program = ts.createProgram(files, compilerOptions);
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => !diagnostic.file || isPathInside(srcPath, path.resolve(diagnostic.file.fileName)))
    .filter((diagnostic) => !isWorkspaceDependencyRootDirDiagnostic(diagnostic, cwd));

  for (const file of files) {
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) {
      throw new Error(`Failed to load ${file} while building declarations for ${cwd}`);
    }
    const emitResult = program.emit(sourceFile, undefined, undefined, true);
    diagnostics.push(...emitResult.diagnostics);
  }

  if (diagnostics.length) {
    const details = ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticHost);
    throw new Error(`Failed to build declarations for ${cwd} \n${details}`);
  }
};
