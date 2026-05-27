#!/usr/bin/env node
/**
 * api-discover CLI dispatcher.
 *
 *   api-discover doctor
 *   api-discover capture <url> -o <dir> [-d <sec>]
 *   api-discover inline --tab-id <id> --trigger <cmd> -o <dir>
 *   api-discover analyze <run-dir> [--format json|md|both] [--rules <ids>]
 *   api-discover --help
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const LIB = path.join(ROOT, 'lib');
const CAPTURE_PY = path.join(LIB, 'capture', 'capture.py');
const INLINE_PY = path.join(LIB, 'capture', 'inline_capture.py');
const DISCOVER_MJS = path.join(LIB, 'spec-gen', 'discover.mjs');
const ANALYZER_MJS = path.join(LIB, 'auth-analyzer', 'analyze.mjs');

const COLORS = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function printHelp() {
  console.log(`api-discover: point at any website, get a typed API client.

USAGE
  api-discover <command> [options]

COMMANDS
  doctor                                     Pre-flight check: browser-harness,
                                              port 9222, deps.

  capture <url> -o <dir> [-d <sec>]          Canned mode. Opens <url> in a fresh
                                              tab, captures <sec> seconds of XHR
                                              traffic, emits spec + client +
                                              auth-analysis to <dir>.

  inline --tab-id <id> --trigger <cmd>       Inline / escape-hatch mode. Captures
              -o <dir>                        traffic on an already-configured
                                              tab without re-navigation.

  analyze <run-dir> [--format md|json|both]  Run auth-analyzer on an existing
              [--rules <id,id>]               capture directory.

OPTIONS
  -h, --help                  Show this help and exit.
  --version                   Print version and exit.

EXAMPLES
  api-discover doctor
  api-discover capture https://httpbin.org/ -o ./out/httpbin -d 30
  api-discover analyze ./out/httpbin

LEARN MORE
  https://github.com/PythonLuvr/api-discover
`);
}

function readPkgVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

function which(cmd) {
  const ext = process.platform === 'win32' ? ['.cmd', '.exe', '.bat', ''] : [''];
  const pathDirs = (process.env.PATH || '').split(path.delimiter);
  for (const dir of pathDirs) {
    for (const e of ext) {
      const candidate = path.join(dir, cmd + e);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {}
    }
  }
  return null;
}

async function probeCdp(port = 9222, timeoutMs = 800) {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    fetch(`http://127.0.0.1:${port}/json/version`, { signal: controller.signal })
      .then(async (r) => {
        clearTimeout(t);
        if (!r.ok) return resolve({ ok: false, status: r.status });
        const data = await r.json().catch(() => ({}));
        resolve({ ok: true, browser: data.Browser, version: data['Protocol-Version'] });
      })
      .catch(() => {
        clearTimeout(t);
        resolve({ ok: false });
      });
  });
}

async function cmdDoctor() {
  console.log(`api-discover v${readPkgVersion()} doctor\n`);

  const checks = [];

  const nodeOk = parseInt(process.versions.node.split('.')[0], 10) >= 18;
  checks.push({
    name: 'Node 18+',
    ok: nodeOk,
    detail: `node ${process.versions.node}`,
  });

  const bh = which('browser-harness');
  checks.push({
    name: 'browser-harness on PATH',
    ok: !!bh,
    detail: bh || 'NOT FOUND',
    fix: bh ? null : 'Install with: uv tool install browser-harness',
  });

  const py = which('python') || which('python3') || which('py');
  checks.push({
    name: 'Python 3.10+ on PATH',
    ok: !!py,
    detail: py || 'NOT FOUND',
    fix: py ? null : 'Install Python 3.10+ from python.org',
  });

  const cdp = await probeCdp(9222);
  checks.push({
    name: 'Chrome/Edge on CDP port 9222',
    ok: cdp.ok,
    detail: cdp.ok ? `${cdp.browser} (protocol ${cdp.version})` : 'NOT LISTENING',
    fix: cdp.ok ? null : (process.platform === 'win32'
      ? "Launch: & 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' --remote-debugging-port=9222 --user-data-dir=\"$env:USERPROFILE\\bh-profile\""
      : "Launch: brave --remote-debugging-port=9222 --user-data-dir=\"$HOME/bh-profile\""),
  });

  for (const [name, p] of [
    ['capture.py', CAPTURE_PY],
    ['inline_capture.py', INLINE_PY],
    ['spec-gen/discover.mjs', DISCOVER_MJS],
    ['auth-analyzer/analyze.mjs', ANALYZER_MJS],
  ]) {
    checks.push({
      name: `bundled: ${name}`,
      ok: fs.existsSync(p),
      detail: fs.existsSync(p) ? 'present' : p,
    });
  }

  let allOk = true;
  for (const c of checks) {
    const tag = c.ok ? COLORS.green('[ok]') : COLORS.red('[!!]');
    console.log(`  ${tag} ${c.name.padEnd(35)} ${COLORS.dim(c.detail)}`);
    if (!c.ok) {
      allOk = false;
      if (c.fix) console.log(`       ${COLORS.yellow('fix:')} ${c.fix}`);
    }
  }

  console.log('');
  if (allOk) {
    console.log(COLORS.green('All checks passed. Ready to capture.'));
    process.exit(0);
  } else {
    console.log(COLORS.red('One or more checks failed. Fix the items above before capturing.'));
    process.exit(1);
  }
}

function parseFlags(argv, defs) {
  const out = { _: [] };
  for (const [k, d] of Object.entries(defs)) if ('default' in d) out[k] = d.default;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    let matched = false;
    for (const [name, d] of Object.entries(defs)) {
      const aliases = [`--${name}`, ...(d.alias ? [`-${d.alias}`] : [])];
      if (aliases.includes(a)) {
        if (d.takesValue) {
          out[name] = argv[++i];
        } else {
          out[name] = true;
        }
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (a.startsWith('-')) {
        console.error(`unknown flag: ${a}`);
        process.exit(2);
      }
      out._.push(a);
    }
  }
  return out;
}

async function cmdCapture(args) {
  const opts = parseFlags(args, {
    out: { alias: 'o', takesValue: true },
    duration: { alias: 'd', takesValue: true, default: '60' },
    bodies: { takesValue: true, default: '1' },
  });
  const url = opts._[0];
  if (!url || !opts.out) {
    console.error('usage: api-discover capture <url> -o <dir> [-d <sec>]');
    process.exit(2);
  }

  const outDir = path.resolve(opts.out);
  fs.mkdirSync(path.join(outDir, 'cdp', 'network'), { recursive: true });

  const bh = which('browser-harness');
  if (!bh) {
    console.error(COLORS.red('browser-harness not found. Run `api-discover doctor`.'));
    process.exit(1);
  }

  const cdp = await probeCdp(9222);
  if (!cdp.ok) {
    console.error(COLORS.red('CDP port 9222 not responding. Run `api-discover doctor` for the launch command.'));
    process.exit(1);
  }

  console.log(`[capture] target: ${url}`);
  console.log(`[capture] out:    ${outDir}`);
  console.log(`[capture] dur:    ${opts.duration}s`);
  console.log(`[capture] driver: ${bh}`);
  console.log('');

  const captureCmd = `exec(open(r"${CAPTURE_PY}", encoding="utf-8").read())`;
  const env = {
    ...process.env,
    BH2API_URL: url,
    BH2API_OUT: outDir,
    BH2API_DURATION: opts.duration,
    BH2API_BODIES: opts.bodies,
  };

  const result = spawnSync(bh, ['-c', captureCmd], {
    env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    console.error(COLORS.red(`[capture] browser-harness exited ${result.status}`));
    process.exit(result.status || 1);
  }

  console.log('');
  console.log(`[spec-gen] running...`);
  const specRes = spawnSync(process.execPath, [DISCOVER_MJS, '--run', outDir], {
    stdio: 'inherit',
  });
  if (specRes.status !== 0) {
    console.error(COLORS.red(`[spec-gen] discover.mjs exited ${specRes.status}`));
    process.exit(specRes.status || 1);
  }

  console.log('');
  console.log(`[analyze] running...`);
  const azRes = spawnSync(process.execPath, [ANALYZER_MJS, outDir], {
    stdio: 'inherit',
  });
  if (azRes.status !== 0) {
    console.error(COLORS.yellow(`[analyze] analyzer exited ${azRes.status} (non-fatal, spec is still emitted)`));
  }

  console.log('');
  console.log(COLORS.green('Done.'));
  console.log(`  ${path.join(outDir, 'api-spec', 'index.html')}`);
  console.log(`  ${path.join(outDir, 'auth-analysis.md')}`);
}

async function cmdInline(args) {
  const opts = parseFlags(args, {
    out: { alias: 'o', takesValue: true },
    'tab-id': { takesValue: true },
    trigger: { takesValue: true, default: '' },
    duration: { alias: 'd', takesValue: true, default: '60' },
    bodies: { takesValue: true, default: '1' },
  });

  if (!opts.out || !opts['tab-id']) {
    console.error('usage: api-discover inline --tab-id <id> [--trigger <cmd>] -o <dir> [-d <sec>]');
    console.error('');
    console.error('To find <id>, run:');
    console.error('  browser-harness -c "import json; print(json.dumps(list_tabs()))"');
    process.exit(2);
  }

  const outDir = path.resolve(opts.out);
  fs.mkdirSync(path.join(outDir, 'cdp', 'network'), { recursive: true });

  const bh = which('browser-harness');
  if (!bh) {
    console.error(COLORS.red('browser-harness not found. Run `api-discover doctor`.'));
    process.exit(1);
  }

  console.log(`[inline] tab:      ${opts['tab-id']}`);
  console.log(`[inline] out:      ${outDir}`);
  console.log(`[inline] dur:      ${opts.duration}s`);
  console.log(`[inline] trigger:  ${opts.trigger || '(none, capture passive)'}`);
  console.log('');

  const env = {
    ...process.env,
    BH2API_OUT: outDir,
    BH2API_DURATION: opts.duration,
    BH2API_BODIES: opts.bodies,
    BH2API_TRIGGER: opts.trigger,
  };

  const inlineCmd =
    `switch_tab('${opts['tab-id']}'); import time; time.sleep(0.5); ` +
    `exec(open(r"${INLINE_PY}", encoding="utf-8").read())`;

  const result = spawnSync(bh, ['-c', inlineCmd], {
    env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    console.error(COLORS.red(`[inline] browser-harness exited ${result.status}`));
    process.exit(result.status || 1);
  }

  console.log('');
  console.log(`[spec-gen] running...`);
  spawnSync(process.execPath, [DISCOVER_MJS, '--run', outDir], { stdio: 'inherit' });

  console.log('');
  console.log(`[analyze] running...`);
  spawnSync(process.execPath, [ANALYZER_MJS, outDir], { stdio: 'inherit' });

  console.log('');
  console.log(COLORS.green('Done.'));
}

async function cmdAnalyze(args) {
  const opts = parseFlags(args, {
    format: { takesValue: true, default: 'both' },
    rules: { takesValue: true },
  });
  const runDir = opts._[0];
  if (!runDir) {
    console.error('usage: api-discover analyze <run-dir> [--format md|json|both] [--rules <id,id>]');
    process.exit(2);
  }
  const passthrough = [path.resolve(runDir), '--format', opts.format];
  if (opts.rules) passthrough.push('--rules', opts.rules);

  const res = spawnSync(process.execPath, [ANALYZER_MJS, ...passthrough], {
    stdio: 'inherit',
  });
  process.exit(res.status || 0);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    printHelp();
    process.exit(0);
  }
  if (argv[0] === '--version') {
    console.log(readPkgVersion());
    process.exit(0);
  }
  const cmd = argv[0];
  const rest = argv.slice(1);
  switch (cmd) {
    case 'doctor':   await cmdDoctor(); break;
    case 'capture':  await cmdCapture(rest); break;
    case 'inline':   await cmdInline(rest); break;
    case 'analyze':  await cmdAnalyze(rest); break;
    default:
      console.error(`unknown command: ${cmd}`);
      console.error('');
      printHelp();
      process.exit(2);
  }
}

main().catch((err) => {
  console.error(COLORS.red('FATAL:'), err.stack || err.message || err);
  process.exit(1);
});
