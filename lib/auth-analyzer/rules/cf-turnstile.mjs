import { redact } from '../lib/redact.mjs';

export default {
  id: 'cf-turnstile',
  scope: 'request',
  severity: 'blocking',
  title: 'Cloudflare Turnstile detected',
  match(run) {
    const hits = [];
    for (const req of run.requests) {
      const v = req.headers['cf-turnstile-response'] || req.headers['cf-chl-bypass'];
      if (v) {
        hits.push({
          request_id: req.id,
          endpoint: `${req.method} ${req.path}`,
          header: req.headers['cf-turnstile-response'] ? 'cf-turnstile-response' : 'cf-chl-bypass',
          header_value_redacted: redact(v),
        });
      }
    }
    return hits;
  },
  explanation:
    'Cloudflare Turnstile generates a per-request token via client-side JS. ' +
    'The token cannot be reproduced outside a real browser session.',
  recommendation:
    "Run the replay client inside the live browser tab via cdp('Runtime.evaluate'), " +
    'or drive the UI directly and skip pure HTTP replay.',
  execution_model: 'in_browser',
};
