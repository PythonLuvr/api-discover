#!/usr/bin/env node
/**
 * Auth-analyzer test runner. Validates that each fixture triggers the
 * expected rule with the expected severity.
 *
 * Run: npm test
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAnalysis } from '../lib/auth-analyzer/analyze.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'auth-analyzer');

const EXPECT = {
  'cf-turnstile':         { rule: 'cf-turnstile',         severity: 'blocking', verdict: 'blocked' },
  'hcaptcha':             { rule: 'hcaptcha',             severity: 'blocking', verdict: 'blocked' },
  'recaptcha':            { rule: 'recaptcha',            severity: 'blocking', verdict: 'blocked' },
  'ws-delivered-result':  { rule: 'ws-delivered-result',  severity: 'blocking', verdict: 'blocked' },
  'csrf-laravel':         { rule: 'csrf-laravel',         severity: 'warn',     verdict: 'partial' },
  'csrf-django':          { rule: 'csrf-django',          severity: 'warn',     verdict: 'partial' },
  'csrf-double-submit':   { rule: 'csrf-double-submit',   severity: 'warn',     verdict: 'partial' },
  'bearer-static':        { rule: 'bearer-static',        severity: 'ok',       verdict: 'feasible' },
  'bearer-rotating':      { rule: 'bearer-rotating',      severity: 'warn',     verdict: 'partial' },
  'tenant-scoping':       { rule: 'tenant-scoping-header',severity: 'warn',     verdict: 'partial' },
  'session-cookie-only':  { rule: 'session-cookie-only',  severity: 'ok',       verdict: 'feasible' },
  'sso-redirect-chain':   { rule: 'sso-redirect-chain',   severity: 'blocking', verdict: 'blocked' },
  'request-signing':      { rule: 'request-signing-hmac', severity: 'blocking', verdict: 'blocked' },
  'tracing-noise':        { rule: 'tracing-noise',        severity: 'info',     verdict: 'feasible' },
  'cors-preflight-noise': { rule: 'cors-preflight-noise', severity: 'info',     verdict: 'feasible' },
};

let passed = 0;
let failed = 0;
const failures = [];

const C = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

const fixtures = fs.readdirSync(FIXTURES_DIR).filter((f) =>
  fs.statSync(path.join(FIXTURES_DIR, f)).isDirectory()
);

for (const name of fixtures) {
  const expected = EXPECT[name];
  if (!expected) {
    console.log(`${C.dim('?')} ${name.padEnd(26)} no expectation defined, skipping`);
    continue;
  }
  const runDir = path.join(FIXTURES_DIR, name);
  let analysis;
  try {
    analysis = runAnalysis(runDir, null);
  } catch (err) {
    failed++;
    failures.push({ name, reason: `analyzer threw: ${err.message}` });
    console.log(`${C.red('FAIL')} ${name.padEnd(26)} threw: ${err.message}`);
    continue;
  }

  const matched = analysis.findings.find((f) => f.id === expected.rule);
  const problems = [];
  if (!matched) {
    problems.push(`expected rule "${expected.rule}" to fire, but it did not`);
    problems.push(`fired rules: ${analysis.findings.map((f) => f.id).join(', ') || '(none)'}`);
  } else if (matched.severity !== expected.severity) {
    problems.push(`rule "${expected.rule}" fired with severity "${matched.severity}", expected "${expected.severity}"`);
  }
  if (analysis.verdict !== expected.verdict) {
    problems.push(`verdict was "${analysis.verdict}", expected "${expected.verdict}"`);
  }

  if (problems.length === 0) {
    passed++;
    console.log(`${C.green('PASS')} ${name.padEnd(26)} ${C.dim(`${matched.id} -> ${analysis.verdict}`)}`);
  } else {
    failed++;
    failures.push({ name, reason: problems.join(' / ') });
    console.log(`${C.red('FAIL')} ${name.padEnd(26)} ${problems[0]}`);
    for (const p of problems.slice(1)) console.log(`   ${C.dim(p)}`);
  }
}

console.log('');
console.log(`${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('');
  for (const f of failures) console.log(`  ${C.red('FAIL')} ${f.name}: ${f.reason}`);
  process.exit(1);
}

process.exit(0);
