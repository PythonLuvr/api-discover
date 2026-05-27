/**
 * Load a CDP capture run into the shape the rules expect.
 *
 * Input directory layout:
 *   <run>/cdp/network/requests.jsonl     (Network.requestWillBeSent events)
 *   <run>/cdp/network/responses.jsonl    (Network.responseReceived events)
 *   <run>/cdp/network/ws-frames.jsonl    (optional: Network.webSocketFrameReceived)
 *   <run>/cdp/network/bodies/<rid>/{request.json,response.json}  (optional)
 *
 * Output shape:
 *   {
 *     runDir,
 *     requests: [{ id, method, url, path, origin, headers, cookies, postData }],
 *     responses: [{ id, status, headers, body }],
 *     pairs: [{ request, response }],
 *     wsFrames: [{ requestId, opcode, payloadData }],
 *     cookies: { name: value, ... }   // aggregated across all requests
 *   }
 */

import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';

function readJsonl(p) {
  if (!fs.existsSync(p)) return [];
  const text = fs.readFileSync(p, 'utf8');
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch {}
  }
  return out;
}

function parseCookieHeader(value) {
  const out = {};
  if (!value) return out;
  for (const part of String(value).split(/;\s*/)) {
    const ix = part.indexOf('=');
    if (ix <= 0) continue;
    out[part.slice(0, ix).trim()] = part.slice(ix + 1).trim();
  }
  return out;
}

function lowerHeaders(headers = {}) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k.toLowerCase()] = v;
  }
  return out;
}

function safeOrigin(url) {
  try { return new URL(url).origin; } catch { return ''; }
}

function safePath(url) {
  try { return new URL(url).pathname; } catch { return url; }
}

export function loadRun(runDir) {
  runDir = path.resolve(runDir);
  const net = path.join(runDir, 'cdp', 'network');
  if (!fs.existsSync(net)) {
    throw new Error(`No CDP capture found at ${net}. Did you run \`api-discover capture\` first?`);
  }

  const reqEvents = readJsonl(path.join(net, 'requests.jsonl'));
  const respEvents = readJsonl(path.join(net, 'responses.jsonl'));
  const wsEvents = readJsonl(path.join(net, 'ws-frames.jsonl'));
  const bodiesDir = path.join(net, 'bodies');

  const requests = [];
  const reqById = new Map();
  const cookies = {};

  for (const ev of reqEvents) {
    const p = ev.params || {};
    const r = p.request || {};
    const headers = lowerHeaders(r.headers || {});
    const rid = p.requestId;
    const url = r.url || '';

    const reqCookies = parseCookieHeader(headers.cookie);
    for (const [k, v] of Object.entries(reqCookies)) cookies[k] = v;

    let postData = r.postData;
    if (!postData) {
      const bp = path.join(bodiesDir, sanitize(rid), 'request.json');
      if (fs.existsSync(bp)) {
        try { postData = JSON.parse(fs.readFileSync(bp, 'utf8')).body; } catch {}
      }
    }

    const req = {
      id: rid,
      method: r.method || 'GET',
      url,
      origin: safeOrigin(url),
      path: safePath(url),
      headers,
      cookies: reqCookies,
      postData: postData || null,
      _raw: ev,
    };
    requests.push(req);
    reqById.set(rid, req);
  }

  const responses = [];
  const respByReqId = new Map();

  for (const ev of respEvents) {
    const p = ev.params || {};
    const rr = p.response || {};
    const rid = p.requestId;
    const headers = lowerHeaders(rr.headers || {});
    let body = null;
    const bp = path.join(bodiesDir, sanitize(rid), 'response.json');
    if (fs.existsSync(bp)) {
      try { body = JSON.parse(fs.readFileSync(bp, 'utf8')).body; } catch {}
    }
    const resp = {
      id: rid,
      status: rr.status,
      url: rr.url,
      headers,
      body,
      _raw: ev,
    };
    responses.push(resp);
    respByReqId.set(rid, resp);
  }

  const pairs = [];
  for (const req of requests) {
    pairs.push({ request: req, response: respByReqId.get(req.id) || null });
  }

  const wsFrames = wsEvents.map((ev) => {
    const p = ev.params || {};
    const r = p.response || {};
    return {
      requestId: p.requestId,
      opcode: r.opcode,
      payloadData: r.payloadData,
      direction: ev.method === 'Network.webSocketFrameSent' ? 'sent' : 'received',
    };
  });

  return { runDir, requests, responses, pairs, wsFrames, cookies };
}

function sanitize(rid) {
  return String(rid || '').replace(/[^A-Za-z0-9._-]/g, '_');
}
