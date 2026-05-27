export default {
  id: 'csrf-double-submit',
  scope: 'cross',
  severity: 'warn',
  title: 'Double-submit CSRF: matching token in cookie and header',
  match(run) {
    const hits = [];
    const csrfHeaderNames = [
      'x-csrf-token',
      'x-csrftoken',
      'x-xsrf-token',
      'csrf-token',
      'x-anti-csrf',
    ];
    for (const req of run.requests) {
      for (const hName of csrfHeaderNames) {
        const headerVal = req.headers[hName];
        if (!headerVal) continue;
        for (const [cookieName, cookieVal] of Object.entries(req.cookies)) {
          if (cookieVal === headerVal || decodeURIComponent(cookieVal) === headerVal) {
            hits.push({
              request_id: req.id,
              endpoint: `${req.method} ${req.path}`,
              header_name: hName,
              cookie_name: cookieName,
            });
            return hits;
          }
        }
      }
    }
    return hits;
  },
  explanation:
    'A double-submit CSRF pattern was detected: a cookie value is mirrored ' +
    'into a custom header on requests. Generic shape, no framework-specific name.',
  recommendation:
    'In replay client: read the cookie and forward its value into the matching ' +
    'header. Match exactly, including URL-decoding if needed.',
  execution_model: 'http_only',
};
