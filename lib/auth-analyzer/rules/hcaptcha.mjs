import { redact } from '../lib/redact.mjs';

export default {
  id: 'hcaptcha',
  scope: 'request',
  severity: 'blocking',
  title: 'hCaptcha detected',
  match(run) {
    const hits = [];
    for (const req of run.requests) {
      const v = req.headers['h-captcha-response'];
      if (v) {
        hits.push({
          request_id: req.id,
          endpoint: `${req.method} ${req.path}`,
          header: 'h-captcha-response',
          header_value_redacted: redact(v),
        });
      }
    }
    return hits;
  },
  explanation:
    'hCaptcha generates a per-request token via interactive challenge. ' +
    'The token cannot be reproduced outside a real browser session with user interaction.',
  recommendation:
    'Either solve interactively in-browser via cdp Runtime.evaluate, ' +
    'or use a CAPTCHA-solving service as a paid escape hatch.',
  execution_model: 'in_browser',
};
