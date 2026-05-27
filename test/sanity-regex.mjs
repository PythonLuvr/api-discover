#!/usr/bin/env node
/**
 * Scan the repo for personal identifiers, local paths, or accidental leaks
 * that should never appear in a public OSS release.
 *
 * Run before any `git push`. Exit non-zero if anything matches.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SKIP_DIRS = new Set(['.git', 'node_modules', 'out', '.o11y']);
const SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.lock']);
const SELF = path.relative(ROOT, fileURLToPath(import.meta.url));

const FORBIDDEN = [
  { name: 'Local user path (mscmu)',     pattern: /\bmscmu\b/ },
  { name: 'Local user path (C:\\Users)', pattern: /C:\\Users\\(?!<USER>|<USERPROFILE>)\w+/i },
  { name: 'Personal email',              pattern: /viralventures(team|group)?@/i },
  { name: 'EJ-Brain workspace ref',      pattern: /EJ-Brain/ },
  { name: 'Client folder path',          pattern: /\\clients\\[a-zA-Z]/ },
  { name: 'API key pattern (sk-...)',    pattern: /\bsk-[a-zA-Z0-9]{20,}/ },
  { name: 'Anthropic key pattern',       pattern: /\bsk-ant-[a-zA-Z0-9_-]{20,}/ },
  { name: 'OpenAI key pattern',          pattern: /\bsk-proj-[a-zA-Z0-9]{20,}/ },
  { name: 'Bearer token in source',      pattern: /Bearer\s+[a-zA-Z0-9_.\-]{30,}/i },
  { name: 'AWS access key',              pattern: /\bAKIA[0-9A-Z]{16}\b/ },
];

const COLORS = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, out);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SKIP_EXT.has(ext)) continue;
      out.push(p);
    }
  }
  return out;
}

const findings = [];
const files = walk(ROOT);

for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  if (rel === SELF.replace(/\\/g, '/')) continue;
  let content;
  try { content = fs.readFileSync(f, 'utf8'); } catch { continue; }
  for (const rule of FORBIDDEN) {
    const m = content.match(rule.pattern);
    if (m) {
      const idx = m.index || 0;
      const before = content.lastIndexOf('\n', idx) + 1;
      const after = content.indexOf('\n', idx);
      const line = content.slice(before, after === -1 ? content.length : after);
      const lineNo = content.slice(0, idx).split('\n').length;
      findings.push({ file: rel, rule: rule.name, line: lineNo, snippet: line.trim().slice(0, 120) });
    }
  }
}

if (findings.length === 0) {
  console.log(COLORS.green(`Sanity scan clean. ${files.length} files scanned.`));
  process.exit(0);
}

console.log(COLORS.red(`Sanity scan failed. ${findings.length} finding(s):`));
console.log('');
for (const f of findings) {
  console.log(`  ${COLORS.red(f.rule)}`);
  console.log(`    ${f.file}:${f.line}`);
  console.log(`    ${COLORS.dim(f.snippet)}`);
  console.log('');
}
console.log(COLORS.yellow('Fix the findings above before `git push`.'));
process.exit(1);
