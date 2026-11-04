import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return ['__tests__', '__e2e__', 'node_modules', 'dist'].includes(entry.name) ? [] : sourceFiles(file);
    }
    return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [file] : [];
  });
}

export function importsOf(source: string, filename = 'module.ts'): string[] {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const imports: string[] = [];
  function visit(node: ts.Node): void {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const expression = node.moduleReference.expression;
      if (expression && ts.isStringLiteral(expression)) imports.push(expression.text);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      if (ts.isStringLiteral(node.argument.literal)) imports.push(node.argument.literal.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteralLike(argument)) imports.push(argument.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return imports;
}

const frontendLayers = ['shared', 'entities', 'features', 'widgets', 'pages', 'app'];

export function frontendBoundary(file: string): { layer: string; slice: string; root: string } | undefined {
  const match = file.replaceAll('\\', '/').match(/^(.*\/src\/client(?:-v2)?)\/(\w+)(?:\/([^/]+))?/);
  if (!match || !frontendLayers.includes(match[2])) return undefined;
  const [, client, layer, name] = match;
  const slice = layer === 'app' ? layer : name;
  return { layer, slice, root: `${client}/${layer}${layer === 'app' ? '' : `/${slice}`}` };
}

export function boundaryViolation(source: string, target: string, dependency: string): string | undefined {
  const isClient = /\/src\/client(?:-v2)?\//.test(source);
  const isServer = source.includes('/src/server/');
  const isContract = /\/src\/(?:shared|contracts)\//.test(source);
  if (
    isClient &&
    (/\/src\/server\//.test(target) || /^@nocobase\/(server|database|actions)(?:\/|$)/.test(dependency))
  ) {
    return 'frontend imports backend';
  }
  if (isServer && (/\/src\/client(?:-v2)?\//.test(target) || /^@nocobase\/client(?:-v2)?(?:\/|$)/.test(dependency))) {
    return 'backend imports frontend';
  }
  if (isContract && (/\/src\/(server|client|client-v2)\//.test(target) || !dependency.startsWith('.'))) {
    return 'shared contracts depend on runtime';
  }
  if (source.includes('/src/client-v2/') && /^@nocobase\/client(?:\/|$)/.test(dependency)) {
    return 'v2 imports v1';
  }
  const serverLayer = source.match(/\/src\/server\/([^/]+)\//)?.[1];
  const targetLayer = target.match(/\/src\/server\/([^/]+)\//)?.[1];
  if (serverLayer === 'domain' || serverLayer === 'application') {
    const allowed = serverLayer === 'domain' ? ['domain'] : ['domain', 'application'];
    if ((!dependency.startsWith('.') && !target.includes('/src/')) || (targetLayer && !allowed.includes(targetLayer))) {
      return 'inner Onion layer imports an external dependency';
    }
    if (target.includes('/src/') && !targetLayer && !/\/src\/(shared|contracts)\//.test(target)) {
      return 'inner Onion layer imports an entry point';
    }
  }
  if (serverLayer === 'infrastructure' && targetLayer && ['interfaces', 'composition'].includes(targetLayer)) {
    return 'infrastructure imports delivery/composition';
  }
  if (!isClient) return undefined;
  const from = frontendBoundary(source);
  const to = frontendBoundary(target);
  if (!from || !to || from.root === to.root) return undefined;
  if (frontendLayers.indexOf(from.layer) < frontendLayers.indexOf(to.layer)) return 'FSD import points upwards';
  if (from.layer === to.layer && !['app', 'shared'].includes(from.layer)) return 'FSD sibling slices are coupled';
  if (to.layer !== 'app' && ![`${to.root}/index.ts`, `${to.root}/index.tsx`].includes(target))
    return 'FSD public API is bypassed';
  return undefined;
}
