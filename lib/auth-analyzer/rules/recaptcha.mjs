import { redact } from '../lib/redact.mjs';

export default {
  id: 'recaptcha',
  scope: 'request',
  severity: 'blocking',
  title: 'Google reCAPTCHA detected',
  match(run) {
    const hits = [];
    for (const req of run.requests) {
      const v = req.headers['g-recaptcha-response']
        || (req.postData && /g-recaptcha-response/.test(String(req.postData)) ? 'inline' : null);
      if (v) {
        hits.push({
          request_id: req.id,
          endpoint: `${req.method} ${req.path}`,
          header: 'g-recaptcha-response',
          header_value_redacted: v === 'inline' ? '(in form body)' : redact(v),
        });
      }
    }
    return hits;
  },
  explanation:
    'Google reCAPTCHA generates a per-request token. v3 is score-based and ' +
    'invisible; v2 requires user interaction. Both are bound to the browser session.',
  recommendation:
    "Run the replay inside the live browser via cdp('Runtime.evaluate'), " +
    'or drive the UI to trigger the verification flow.',
  execution_model: 'in_browser',
};
