#!/usr/bin/env node
/**
 * Generate synthetic CDP capture fixtures for the auth-analyzer test suite.
 *
 * Each fixture is a minimal capture directory that triggers exactly one rule.
 * Run: node test/fixtures/build-fixtures.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, 'auth-analyzer');

function writeFixture(name, { requests = [], responses = [], wsFrames = [] }) {
  const dir = path.join(ROOT, name, 'cdp', 'network');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'requests.jsonl'),
    requests.map((r) => JSON.stringify(r)).join('\n') + (requests.length ? '\n' : ''),
    'utf8'
  );
  fs.writeFileSync(
    path.join(dir, 'responses.jsonl'),
    responses.map((r) => JSON.stringify(r)).join('\n') + (responses.length ? '\n' : ''),
    'utf8'
  );
  fs.writeFileSync(
    path.join(dir, 'ws-frames.jsonl'),
    wsFrames.map((r) => JSON.stringify(r)).join('\n') + (wsFrames.length ? '\n' : ''),
    'utf8'
  );
}

function req(id, method, url, headers = {}, postData = null) {
  return {
    method: 'Network.requestWillBeSent',
    params: {
      requestId: id,
      request: { url, method, headers, postData },
    },
  };
}

function resp(id, status, url, headers = {}) {
  return {
    method: 'Network.responseReceived',
    params: {
      requestId: id,
      response: { url, status, headers },
    },
  };
}

function wsFrame(id, payload, direction = 'received') {
  return {
    method: direction === 'sent' ? 'Network.webSocketFrameSent' : 'Network.webSocketFrameReceived',
    params: {
      requestId: id,
      response: { opcode: 1, payloadData: payload },
    },
  };
}

// ---------- cf-turnstile ----------
writeFixture('cf-turnstile', {
  requests: [
    req('1', 'POST', 'https://protected.example.com/api/generate', {
      'Content-Type': 'application/json',
      'cf-turnstile-response': '0.aXJsYWtqaGRsa2pmaGFsa2pkZmhhbGtqZGZoYWxramRm',
    }, '{"prompt":"hello"}'),
  ],
  responses: [
    resp('1', 200, 'https://protected.example.com/api/generate'),
  ],
});

// ---------- hcaptcha ----------
writeFixture('hcaptcha', {
  requests: [
    req('1', 'POST', 'https://app.example.com/signup', {
      'h-captcha-response': '10000000-aaaa-bbbb-cccc-000000000001',
    }),
  ],
  responses: [resp('1', 200, 'https://app.example.com/signup')],
});

// ---------- recaptcha ----------
writeFixture('recaptcha', {
  requests: [
    req('1', 'POST', 'https://app.example.com/login', {
      'g-recaptcha-response': '03AGdBq25SiS6Sxx...truncated...XYZ',
    }),
  ],
  responses: [resp('1', 200, 'https://app.example.com/login')],
});

// ---------- ws-delivered-result ----------
writeFixture('ws-delivered-result', {
  requests: [
    req('1', 'POST', 'https://app.example.com/api/jobs', {
      'Content-Type': 'application/json',
    }, '{"prompt":"x"}'),
  ],
  responses: [
    resp('1', 200, 'https://app.example.com/api/jobs'),
  ],
  wsFrames: [
    wsFrame('ws-1', '{"event":"job.done","job_id":"job_abc123","url":"https://cdn.example.com/x.png"}'),
  ],
});

// Add a response body file for the POST so the rule sees status:queued + job_id
{
  const dir = path.join(ROOT, 'ws-delivered-result', 'cdp', 'network', 'bodies', '1');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'response.json'),
    JSON.stringify({ body: '{"status":"queued","job_id":"job_abc123"}' }),
    'utf8'
  );
}

// ---------- csrf-laravel ----------
writeFixture('csrf-laravel', {
  requests: [
    req('1', 'POST', 'https://app.example.com/users', {
      'Cookie': 'laravel_session=sess_xyz; XSRF-TOKEN=eyJhbGciOi...',
      'x-xsrf-token': 'eyJhbGciOi...',
    }),
  ],
  responses: [resp('1', 200, 'https://app.example.com/users')],
});

// ---------- csrf-django ----------
writeFixture('csrf-django', {
  requests: [
    req('1', 'POST', 'https://app.example.com/api/items', {
      'Cookie': 'sessionid=sess_xyz; csrftoken=tok_abc123',
      'x-csrftoken': 'tok_abc123',
    }),
  ],
  responses: [resp('1', 200, 'https://app.example.com/api/items')],
});

// ---------- csrf-double-submit ----------
writeFixture('csrf-double-submit', {
  requests: [
    req('1', 'POST', 'https://app.example.com/api/x', {
      'Cookie': 'X-MY-CSRF=abc123def456',
      'x-csrf-token': 'abc123def456',
    }),
  ],
  responses: [resp('1', 200, 'https://app.example.com/api/x')],
});

// ---------- bearer-static ----------
writeFixture('bearer-static', {
  requests: [
    req('1', 'GET', 'https://api.example.com/me', { 'Authorization': 'Bearer tok_static_abc123xyz' }),
    req('2', 'GET', 'https://api.example.com/projects', { 'Authorization': 'Bearer tok_static_abc123xyz' }),
    req('3', 'POST', 'https://api.example.com/projects', { 'Authorization': 'Bearer tok_static_abc123xyz' }),
  ],
  responses: [
    resp('1', 200, 'https://api.example.com/me'),
    resp('2', 200, 'https://api.example.com/projects'),
    resp('3', 201, 'https://api.example.com/projects'),
  ],
});

// ---------- bearer-rotating ----------
writeFixture('bearer-rotating', {
  requests: [
    req('1', 'GET', 'https://api.example.com/me', { 'Authorization': 'Bearer tok_v1_aaa' }),
    req('2', 'POST', 'https://auth.example.com/oauth/token', { 'Authorization': 'Bearer tok_v1_aaa' }),
    req('3', 'GET', 'https://api.example.com/projects', { 'Authorization': 'Bearer tok_v2_bbb' }),
  ],
  responses: [
    resp('1', 200, 'https://api.example.com/me'),
    resp('2', 200, 'https://auth.example.com/oauth/token'),
    resp('3', 200, 'https://api.example.com/projects'),
  ],
});

// ---------- tenant-scoping ----------
writeFixture('tenant-scoping', {
  requests: [
    req('1', 'GET', 'https://api.example.com/items', { 'x-workspace-id': 'ws_123', 'Authorization': 'Bearer t' }),
    req('2', 'GET', 'https://api.example.com/items', { 'x-workspace-id': 'ws_123', 'Authorization': 'Bearer t' }),
    req('3', 'POST', 'https://api.example.com/items', { 'x-workspace-id': 'ws_123', 'Authorization': 'Bearer t' }),
    req('4', 'GET', 'https://api.example.com/me', { 'x-workspace-id': 'ws_123', 'Authorization': 'Bearer t' }),
  ],
  responses: [
    resp('1', 200, 'https://api.example.com/items'),
    resp('2', 200, 'https://api.example.com/items'),
    resp('3', 201, 'https://api.example.com/items'),
    resp('4', 200, 'https://api.example.com/me'),
  ],
});

// ---------- session-cookie-only ----------
writeFixture('session-cookie-only', {
  requests: [
    req('1', 'GET', 'https://app.example.com/dashboard', { 'Cookie': 'sessionid=sess_xyz' }),
    req('2', 'GET', 'https://app.example.com/api/me', { 'Cookie': 'sessionid=sess_xyz' }),
  ],
  responses: [
    resp('1', 200, 'https://app.example.com/dashboard'),
    resp('2', 200, 'https://app.example.com/api/me'),
  ],
});

// ---------- sso-redirect-chain ----------
writeFixture('sso-redirect-chain', {
  requests: [
    req('1', 'GET', 'https://app.example.com/login'),
    req('2', 'GET', 'https://auth.example.com/saml/login?redirect=app.example.com'),
    req('3', 'GET', 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x'),
    req('4', 'GET', 'https://app.example.com/oauth/callback?code=x'),
  ],
  responses: [
    resp('1', 302, 'https://app.example.com/login'),
    resp('2', 302, 'https://auth.example.com/saml/login'),
    resp('3', 302, 'https://accounts.google.com/o/oauth2/v2/auth'),
    resp('4', 302, 'https://app.example.com/oauth/callback'),
  ],
});

// ---------- request-signing ----------
writeFixture('request-signing', {
  requests: [
    req('1', 'POST', 'https://api.example.com/v1/orders', {
      'x-signature': 'sha256=abc123def456789',
      'x-content-sha256': 'def456abc789',
    }),
  ],
  responses: [resp('1', 200, 'https://api.example.com/v1/orders')],
});

// ---------- tracing-noise ----------
writeFixture('tracing-noise', {
  requests: [
    req('1', 'GET', 'https://app.example.com/me', {
      'Cookie': 'sessionid=sess_xyz',
      'sentry-trace': '00-abc-def-01',
      'baggage': 'sentry-trace_id=abc',
    }),
  ],
  responses: [resp('1', 200, 'https://app.example.com/me')],
});

// ---------- cors-preflight-noise ----------
writeFixture('cors-preflight-noise', {
  requests: [
    req('1', 'OPTIONS', 'https://api.example.com/items'),
    req('2', 'POST', 'https://api.example.com/items', { 'Cookie': 'sessionid=x' }),
  ],
  responses: [
    resp('1', 200, 'https://api.example.com/items'),
    resp('2', 201, 'https://api.example.com/items'),
  ],
});

console.log(`wrote fixtures to ${ROOT}`);
