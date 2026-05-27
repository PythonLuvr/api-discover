import { redact } from '../lib/redact.mjs';

export default {
  id: 'bearer-static',
  scope: 'request',
  severity: 'ok',
  title: 'Static Bearer token in Authorization header',
  match(run) {
    const tokens = new Set();
    const reqWithBearer = [];
    for (const req of run.requests) {
      const auth = req.headers.authorization;
      if (!auth || !/^bearer\s+/i.test(auth)) continue;
      const token = auth.replace(/^bearer\s+/i, '').trim();
      tokens.add(token);
      reqWithBearer.push(req);
    }
    if (reqWithBearer.length === 0) return [];
    if (tokens.size !== 1) return [];
    return [{
      endpoint_count: reqWithBearer.length,
      token_redacted: redact([...tokens][0]),
      note: 'Same token across all observed requests',
    }];
  },
  explanation:
    'A single Bearer token is used across all observed requests. This is the ' +
    'simplest auth pattern to replay: capture once, send as Authorization header.',
  recommendation:
    'In replay client: send Authorization: Bearer <token> header on every request. ' +
    'Token will expire eventually; document the refresh path or treat as session-' +
    'scoped.',
  execution_model: 'http_only',
};
