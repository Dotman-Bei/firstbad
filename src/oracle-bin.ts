#!/usr/bin/env node
import { installOracleSignalHandlers, runOracle } from './oracle.js';

installOracleSignalHandlers();

const at = process.argv.indexOf('--session');
const sessionPath = at >= 0 ? process.argv[at + 1] : undefined;
if (sessionPath === undefined) {
  process.stdout.write('firstbad oracle: --session <file> is required\n');
  process.exitCode = 128;
} else {
  runOracle(sessionPath, process.cwd()).then(
    (code) => {
      process.exitCode = code;
    },
    () => {
      process.exitCode = 128;
    },
  );
}
