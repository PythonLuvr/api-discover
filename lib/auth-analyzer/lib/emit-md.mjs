/**
 * Render the analysis report as markdown.
 */

const SEV_BADGE = {
  blocking: '[BLOCKING]',
  warn: '[WARN]',
  ok: '[OK]',
  info: '[INFO]',
};

const VERDICT_BANNER = {
  blocked: 'HTTP-only replay NOT FEASIBLE without browser context.',
  partial: 'HTTP-only replay FEASIBLE, but requires careful header handling.',
  feasible: 'HTTP-only replay FEASIBLE.',
};

const EXEC_MODEL_DOC = {
  http_only: 'Plain fetch() calls with captured cookies + handled CSRF will work.',
  in_browser: "Must run inside the live page via cdp(\"Runtime.evaluate\").",
  ui_driven: 'Must drive the UI (clicks + DOM polling). No HTTP shortcut.',
  hybrid: 'Some endpoints work HTTP-only, others need browser context.',
};

export function emitMarkdown(analysis) {
  const lines = [];
  const { target, endpoints_total, origins, verdict, execution_model, findings, summary } = analysis;

  lines.push(`# Auth Analysis: ${target}`);
  lines.push('');
  lines.push(`**Endpoints captured:** ${endpoints_total}`);
  lines.push(`**Origins observed:** ${origins.length > 0 ? origins.join(', ') : '(none detected)'}`);
  lines.push('');
  lines.push(`## VERDICT: ${verdict.toUpperCase()}`);
  lines.push('');
  lines.push(`> ${VERDICT_BANNER[verdict] || verdict}`);
  lines.push('');
  lines.push(`**Recommended execution model:** \`${execution_model}\``);
  lines.push('');
  lines.push(`${EXEC_MODEL_DOC[execution_model] || ''}`);
  lines.push('');
  lines.push(`**Summary:** ${summary.blocking} BLOCKING, ${summary.warn} WARN, ${summary.ok} OK, ${summary.info} INFO.`);
  lines.push('');

  if (findings.length === 0) {
    lines.push('## Findings');
    lines.push('');
    lines.push('No findings. Either the capture was empty, or no detection rule matched.');
    lines.push('');
    return lines.join('\n');
  }

  const ordered = [...findings].sort((a, b) => {
    const order = { blocking: 0, warn: 1, ok: 2, info: 3 };
    return order[a.severity] - order[b.severity];
  });

  lines.push('## Findings');
  lines.push('');

  for (const f of ordered) {
    lines.push(`### ${SEV_BADGE[f.severity] || f.severity} ${f.title}`);
    lines.push('');
    lines.push(f.explanation);
    lines.push('');
    if (f.evidence && f.evidence.length > 0) {
      lines.push('**Evidence:**');
      lines.push('');
      lines.push('```');
      for (const e of f.evidence.slice(0, 5)) {
        lines.push(JSON.stringify(e, null, 2));
      }
      if (f.evidence.length > 5) {
        lines.push(`... and ${f.evidence.length - 5} more`);
      }
      lines.push('```');
      lines.push('');
    }
    lines.push('**Recommendation:**');
    lines.push('');
    lines.push(f.recommendation);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push('## What this analyzer does NOT detect');
  lines.push('');
  lines.push('See [api-discover docs](https://github.com/PythonLuvr/api-discover#auth-analyzer)');
  lines.push('for the deferred-detection list (behavioral fingerprinting, encrypted bodies,');
  lines.push('per-page HTML nonces, soft rate-limit warnings).');
  lines.push('');

  return lines.join('\n');
}
