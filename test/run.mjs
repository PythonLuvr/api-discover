#!/usr/bin/env node
/**
 * Top-level test runner. Invokes child test suites and aggregates results.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const suites = [
  ['auth-analyzer', path.join(__dirname, 'analyzer.test.mjs')],
];

let totalFailed = 0;
for (const [name, script] of suites) {
  console.log(`\n=== ${name} ===\n`);
  const r = spawnSync(process.execPath, [script], { stdio: 'inherit' });
  if (r.status !== 0) totalFailed++;
}

console.log('');
if (totalFailed > 0) {
  console.log(`\x1b[31m${totalFailed} suite(s) failed\x1b[0m`);
  process.exit(1);
}
console.log('\x1b[32mAll suites passed\x1b[0m');
