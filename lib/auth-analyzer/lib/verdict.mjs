/**
 * Aggregate findings into a verdict + recommended execution model.
 */

export function aggregateVerdict(findings) {
  const summary = { blocking: 0, warn: 0, ok: 0, info: 0 };
  for (const f of findings) summary[f.severity] = (summary[f.severity] || 0) + 1;

  let verdict;
  let executionModel;

  if (summary.blocking > 0) {
    verdict = 'blocked';
    const firstBlocker = findings.find((f) => f.severity === 'blocking');
    const blockerModels = new Set(
      findings.filter((f) => f.severity === 'blocking').map((f) => f.execution_model || 'in_browser')
    );
    if (blockerModels.size === 1) {
      executionModel = [...blockerModels][0];
    } else {
      executionModel = 'hybrid';
    }
  } else if (summary.warn > 0) {
    verdict = 'partial';
    executionModel = 'http_only';
  } else {
    verdict = 'feasible';
    executionModel = 'http_only';
  }

  return { verdict, executionModel, summary };
}
