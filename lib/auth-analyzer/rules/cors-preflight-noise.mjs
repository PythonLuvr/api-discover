export default {
  id: 'cors-preflight-noise',
  scope: 'request',
  severity: 'info',
  title: 'CORS preflight (OPTIONS) requests in capture',
  match(run) {
    const optionsCount = run.requests.filter((r) => r.method === 'OPTIONS').length;
    if (optionsCount === 0) return [];
    return [{ count: optionsCount }];
  },
  explanation:
    'OPTIONS preflight requests are emitted by the browser before cross-origin ' +
    'state-changing requests. They are not needed in replay clients.',
  recommendation:
    'In replay client: do not emit OPTIONS preflights. fetch/axios will not ' +
    'trigger them outside a browser anyway.',
  execution_model: 'http_only',
};
