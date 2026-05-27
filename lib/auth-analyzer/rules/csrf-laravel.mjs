export default {
  id: 'csrf-laravel',
  scope: 'cross',
  severity: 'warn',
  title: 'Laravel CSRF: XSRF-TOKEN cookie maps to x-xsrf-token header',
  match(run) {
    const hits = [];
    const hasXsrfCookie = 'XSRF-TOKEN' in run.cookies || 'xsrf-token' in run.cookies;
    if (!hasXsrfCookie) return hits;
    for (const req of run.requests) {
      if (req.headers['x-xsrf-token']) {
        hits.push({
          request_id: req.id,
          endpoint: `${req.method} ${req.path}`,
          note: 'Header derived from URL-decoded XSRF-TOKEN cookie',
        });
        break;
      }
    }
    return hits;
  },
  explanation:
    'Laravel sites set an XSRF-TOKEN cookie (URL-encoded) and require it on state-' +
    'changing requests as an x-xsrf-token header. Common gotcha: forgetting to ' +
    'URL-decode the cookie value before sending it as a header.',
  recommendation:
    'In replay client: read the XSRF-TOKEN cookie, URL-decode it, send as ' +
    'x-xsrf-token header on every POST/PUT/PATCH/DELETE.',
  execution_model: 'http_only',
};
