export default {
  id: 'session-cookie-only',
  scope: 'cross',
  severity: 'ok',
  title: 'Plain session-cookie auth, no per-request tokens',
  match(run) {
    if (Object.keys(run.cookies).length === 0) return [];
    const tokenHeaders = [
      'x-csrf-token', 'x-csrftoken', 'x-xsrf-token',
      'authorization', 'cf-turnstile-response', 'h-captcha-response',
      'g-recaptcha-response', 'x-signature',
    ];
    for (const req of run.requests) {
      for (const h of tokenHeaders) {
        if (req.headers[h]) return [];
      }
    }
    const sessionLike = Object.keys(run.cookies).filter((c) =>
      /(session|sid|sess|connect\.sid|laravel_session|django_session|phpsessid|jsessionid)/i.test(c)
    );
    if (sessionLike.length === 0) return [];
    return [{
      session_cookies: sessionLike,
      note: 'No CSRF / bearer / CAPTCHA / signature headers observed',
    }];
  },
  explanation:
    'Only a session cookie was observed, with no CSRF, bearer, CAPTCHA, or ' +
    'signature headers. Simplest possible replay surface.',
  recommendation:
    'In replay client: capture the session cookie once, forward via Cookie ' +
    'header on every request. Watch for session expiry.',
  execution_model: 'http_only',
};
