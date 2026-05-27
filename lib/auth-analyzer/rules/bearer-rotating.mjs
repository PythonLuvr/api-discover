export default {
  id: 'bearer-rotating',
  scope: 'request',
  severity: 'warn',
  title: 'Rotating Bearer tokens (refresh-token flow)',
  match(run) {
    const tokens = new Set();
    let bearerCount = 0;
    for (const req of run.requests) {
      const auth = req.headers.authorization;
      if (!auth || !/^bearer\s+/i.test(auth)) continue;
      tokens.add(auth.replace(/^bearer\s+/i, '').trim());
      bearerCount++;
    }
    if (bearerCount < 2 || tokens.size < 2) return [];
    return [{
      bearer_requests: bearerCount,
      unique_tokens: tokens.size,
      note: 'Token rotates across requests, suggests refresh-token flow',
    }];
  },
  explanation:
    'Multiple distinct Bearer tokens were observed within the capture window. ' +
    'This indicates a refresh-token flow where the access token is rotated ' +
    '(commonly via a /oauth/token or /auth/refresh endpoint).',
  recommendation:
    'Capture the refresh endpoint in the same flow. Replay client must store the ' +
    'refresh token and rotate the access token on 401 responses or on a schedule.',
  execution_model: 'http_only',
};
