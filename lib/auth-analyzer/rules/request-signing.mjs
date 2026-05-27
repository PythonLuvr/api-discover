export default {
  id: 'request-signing-hmac',
  scope: 'request',
  severity: 'blocking',
  title: 'Request signing detected (HMAC or similar)',
  match(run) {
    const signingHeaders = [
      'x-signature',
      'x-amz-signature',
      'x-hmac-signature',
      'x-content-sha256',
      'x-amz-content-sha256',
      'signature',
    ];
    const hits = [];
    const seen = new Set();
    for (const req of run.requests) {
      for (const h of signingHeaders) {
        if (req.headers[h] && !seen.has(h)) {
          seen.add(h);
          hits.push({
            request_id: req.id,
            endpoint: `${req.method} ${req.path}`,
            header: h,
          });
        }
      }
    }
    return hits;
  },
  explanation:
    'A request-signing header was observed. The signature is computed client-side ' +
    'from the request body + a secret key. Without the key, the signature cannot ' +
    'be reproduced.',
  recommendation:
    'Pure HTTP replay is not feasible without the signing key. Either run replay ' +
    "inside the browser via cdp('Runtime.evaluate'), or find where the key is " +
    'stored (commonly in window state, local storage, or returned by a config ' +
    'endpoint) and use the same signing routine.',
  execution_model: 'in_browser',
};
