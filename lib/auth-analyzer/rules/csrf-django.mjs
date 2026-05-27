export default {
  id: 'csrf-django',
  scope: 'cross',
  severity: 'warn',
  title: 'Django CSRF: csrftoken cookie maps to x-csrftoken header',
  match(run) {
    const hits = [];
    if (!('csrftoken' in run.cookies)) return hits;
    for (const req of run.requests) {
      if (req.headers['x-csrftoken'] || req.headers['x-csrf-token']) {
        hits.push({
          request_id: req.id,
          endpoint: `${req.method} ${req.path}`,
          note: 'Header sourced from csrftoken cookie',
        });
        break;
      }
    }
    return hits;
  },
  explanation:
    'Django enforces CSRF protection by setting a csrftoken cookie and requiring ' +
    'a matching x-csrftoken (or x-csrf-token) header on unsafe methods.',
  recommendation:
    'In replay client: read the csrftoken cookie and forward as x-csrftoken header.',
  execution_model: 'http_only',
};
