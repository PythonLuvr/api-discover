export default {
  id: 'tenant-scoping-header',
  scope: 'request',
  severity: 'warn',
  title: 'Tenant scoping header required',
  match(run) {
    const candidates = [
      'x-workspace-id', 'x-workspace',
      'x-org-id', 'x-organization-id', 'x-organization',
      'x-tenant-id', 'x-tenant',
      'x-account-id', 'x-account',
      'x-team-id', 'x-team',
      'x-board-id', 'x-project-id',
    ];
    const counts = {};
    for (const req of run.requests) {
      for (const h of candidates) {
        if (req.headers[h]) {
          counts[h] = (counts[h] || 0) + 1;
        }
      }
    }
    const total = run.requests.length;
    const hits = [];
    for (const [h, n] of Object.entries(counts)) {
      if (n >= 2 && n / total >= 0.25) {
        hits.push({ header: h, occurrences: n, total_requests: total });
      }
    }
    return hits;
  },
  explanation:
    'A tenant/workspace/organization scoping header was observed consistently. ' +
    'Most state-changing endpoints will 403 without it. Replay clients commonly ' +
    'forget to forward this from the captured request.',
  recommendation:
    'In replay client: extract the scoping header value (often equal to a path ' +
    'segment or query param) and forward on every authenticated request.',
  execution_model: 'http_only',
};
