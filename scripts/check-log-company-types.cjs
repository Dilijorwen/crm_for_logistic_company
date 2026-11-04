const path = require('node:path');
const ts = require('typescript');

const target = process.argv[2];
if (!['client', 'server'].includes(target)) throw new Error('Specify client or server.');
const configPath = path.resolve(__dirname, `../packages/plugins/@log-company/tsconfig.${target}.json`);
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(
  config.config,
  ts.sys,
  path.dirname(configPath),
  { noEmit: true },
  configPath,
);
const program = ts.createProgram(parsed.fileNames, parsed.options);
// NocoBase upstream uses a different strictness level. Check owned source with real workspace dependency types.
const diagnostics = [
  ...parsed.errors,
  ...program.getOptionsDiagnostics(),
  ...program.getGlobalDiagnostics(),
  ...program
    .getSourceFiles()
    .filter(
      (file) =>
        file.fileName.includes('/packages/plugins/@log-company/') &&
        !file.fileName.includes('/node_modules/') &&
        !file.fileName.includes('/dist/'),
    )
    .flatMap((file) => [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)]),
];
const host = { getCanonicalFileName: (file) => file, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n' };
console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
console.log(`Log Company ${target}: ${diagnostics.length} type errors`);
process.exitCode = diagnostics.length ? 1 : 0;
