export default {
  id: 'sso-redirect-chain',
  scope: 'cross',
  severity: 'blocking',
  title: 'SSO/OAuth redirect chain detected',
  match(run) {
    const ssoPatterns = [
      /accounts\.google\.com/i,
      /login\.microsoftonline\.com/i,
      /okta\.com/i,
      /auth0\.com/i,
      /signin\.aws\.amazon\.com/i,
      /\boauth(2)?\b/i,
      /\bsaml\b/i,
    ];
    const origins = new Set();
    let sawSso = false;
    let sawRedirect = false;
    for (const { request, response } of run.pairs) {
      origins.add(request.origin);
      if (response && [301, 302, 303, 307, 308].includes(response.status)) sawRedirect = true;
      for (const re of ssoPatterns) {
        if (re.test(request.url)) {
          sawSso = true;
          break;
        }
      }
    }
    if (!sawSso || !sawRedirect || origins.size < 3) return [];
    return [{ origins: [...origins], note: 'Multi-origin redirect chain landing at SSO provider' }];
  },
  explanation:
    'The capture includes a redirect chain through 3+ origins ending at an SSO ' +
    'provider (Google, Microsoft, Okta, Auth0, AWS, generic OAuth/SAML). The ' +
    'session cookie set after that flow is the authentication. Replaying the ' +
    'whole flow HTTP-only requires reproducing the SSO handshake.',
  recommendation:
    'Do not try to reproduce the SSO flow. Capture the post-SSO session cookie ' +
    'and replay against the application API directly. Refresh by re-doing the ' +
    'login in the browser when the cookie expires.',
  execution_model: 'hybrid',
};
