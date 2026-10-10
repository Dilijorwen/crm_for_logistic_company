const path = require('node:path');
const ts = require('typescript');

const configPath = path.resolve(__dirname, '../tsconfig.json');
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
// Upstream NocoBase source is compiled without strict; check this plugin with strict and actual workspace types.
const diagnostics = [
  ...parsed.errors,
  ...program.getOptionsDiagnostics(),
  ...parsed.fileNames.flatMap((name) => {
    const file = program.getSourceFile(name);
    return file ? [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)] : [];
  }),
];
const host = {
  getCanonicalFileName: (file) => file,
  getCurrentDirectory: () => process.cwd(),
  getNewLine: () => '\n',
};
console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
console.log(`Strict plugin diagnostics: ${diagnostics.length}`);
process.exitCode = diagnostics.length ? 1 : 0;
