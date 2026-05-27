/**
 * Rule registry. Order matters for verdict assembly: blockers first.
 */
import cfTurnstile from './cf-turnstile.mjs';
import hcaptcha from './hcaptcha.mjs';
import recaptcha from './recaptcha.mjs';
import wsDeliveredResult from './ws-delivered-result.mjs';
import ssoRedirect from './sso-redirect-chain.mjs';
import requestSigning from './request-signing.mjs';
import csrfLaravel from './csrf-laravel.mjs';
import csrfDjango from './csrf-django.mjs';
import csrfDoubleSubmit from './csrf-double-submit.mjs';
import bearerRotating from './bearer-rotating.mjs';
import tenantScoping from './tenant-scoping.mjs';
import bearerStatic from './bearer-static.mjs';
import sessionCookieOnly from './session-cookie-only.mjs';
import tracingNoise from './tracing-noise.mjs';
import corsPreflightNoise from './cors-preflight-noise.mjs';

export const RULES = [
  cfTurnstile,
  hcaptcha,
  recaptcha,
  wsDeliveredResult,
  ssoRedirect,
  requestSigning,
  csrfLaravel,
  csrfDjango,
  csrfDoubleSubmit,
  bearerRotating,
  tenantScoping,
  bearerStatic,
  sessionCookieOnly,
  tracingNoise,
  corsPreflightNoise,
];

export function rulesById(ids) {
  if (!ids || ids.length === 0) return RULES;
  const set = new Set(ids);
  return RULES.filter((r) => set.has(r.id));
}
