#!/usr/bin/env node
/**
 * Auth analyzer: scan a CDP capture, emit auth-analysis.md + auth-analysis.json.
 *
 *   node analyze.mjs <run-dir> [--format md|json|both] [--rules <id,id>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRun } from './lib/load-run.mjs';
import { aggregateVerdict } from './lib/verdict.mjs';
import { emitMarkdown } from './lib/emit-md.mjs';
import { RULES, rulesById } from './rules/index.mjs';

function parseArgs(argv) {
  const opts = { runDir: null, format: 'both', rules: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--format') opts.format = argv[++i];
    else if (a === '--rules') opts.rules = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '-h' || a === '--help') {
      console.log('usage: analyze.mjs <run-dir> [--format md|json|both] [--rules <id,id>]');
      process.exit(0);
    } else if (!a.startsWith('-') && !opts.runDir) opts.runDir = a;
    else {
      console.error(`unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

function inferTarget(run) {
  const counts = {};
  for (const req of run.requests) {
    if (!req.origin) continue;
    counts[req.origin] = (counts[req.origin] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return 'unknown';
  try {
    return new URL(sorted[0][0]).hostname;
  } catch {
    return sorted[0][0];
  }
}

function uniqueOrigins(run) {
  const set = new Set();
  for (const req of run.requests) if (req.origin) set.add(req.origin);
  return [...set];
}

function runAnalysis(runDir, ruleIds) {
  const run = loadRun(runDir);
  const rules = rulesById(ruleIds);

  const findings = [];
  for (const rule of rules) {
    let evidence;
    try {
      evidence = rule.match(run) || [];
    } catch (err) {
      console.error(`[analyzer] rule "${rule.id}" threw:`, err.message);
      continue;
    }
    if (evidence.length === 0) continue;
    findings.push({
      id: rule.id,
      severity: rule.severity,
      title: rule.title,
      evidence,
      explanation: rule.explanation,
      recommendation: rule.recommendation,
      execution_model: rule.execution_model,
    });
  }

  const target = inferTarget(run);
  const origins = uniqueOrigins(run);
  const { verdict, executionModel, summary } = aggregateVerdict(findings);

  return {
    target,
    endpoints_total: run.requests.length,
    origins,
    verdict,
    execution_model: executionModel,
    findings,
    summary,
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.runDir) {
    console.error('usage: analyze.mjs <run-dir> [--format md|json|both] [--rules <id,id>]');
    process.exit(2);
  }

  let analysis;
  try {
    analysis = runAnalysis(opts.runDir, opts.rules);
  } catch (err) {
    console.error('[analyzer]', err.message);
    process.exit(1);
  }

  const runDir = path.resolve(opts.runDir);
  const fmt = opts.format;

  if (fmt === 'md' || fmt === 'both') {
    const md = emitMarkdown(analysis);
    const p = path.join(runDir, 'auth-analysis.md');
    fs.writeFileSync(p, md, 'utf8');
    console.log(`  wrote ${p}`);
  }
  if (fmt === 'json' || fmt === 'both') {
    const p = path.join(runDir, 'auth-analysis.json');
    fs.writeFileSync(p, JSON.stringify(analysis, null, 2), 'utf8');
    console.log(`  wrote ${p}`);
  }

  console.log('');
  console.log(`VERDICT: ${analysis.verdict.toUpperCase()}  (model: ${analysis.execution_model})`);
  console.log(`  ${analysis.summary.blocking} blocking, ${analysis.summary.warn} warn, ${analysis.summary.ok} ok, ${analysis.summary.info} info`);

  if (analysis.summary.blocking > 0) process.exit(0);
  process.exit(0);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();

export { runAnalysis };
