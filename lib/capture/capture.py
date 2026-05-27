"""
CDP Network capture for browser-to-api. Runs inside browser-harness -c "...".

Opens a new tab to BH2API_URL, captures Network.* events filtered by that tab's
session for BH2API_DURATION seconds, writes the JSONL + bodies shape that
~/.agents/skills/browser-to-api/scripts/discover.mjs expects.

Env contract (set by bh2api wrapper):
  BH2API_URL       target URL
  BH2API_OUT       output directory (absolute path)
  BH2API_DURATION  seconds to capture (default 30)
  BH2API_BODIES    "0" to skip response bodies, otherwise capture them
"""
import base64
import json
import os
import sys
import time
from pathlib import Path

from browser_harness.helpers import _send

URL = os.environ["BH2API_URL"]
OUT = Path(os.environ["BH2API_OUT"]).resolve()
DURATION = float(os.environ.get("BH2API_DURATION", "30"))
CAPTURE_BODIES = os.environ.get("BH2API_BODIES", "1") != "0"

NET = OUT / "cdp" / "network"
BODIES = NET / "bodies"
BODIES.mkdir(parents=True, exist_ok=True)


def _safe_rid(rid):
    return "".join(c if c.isalnum() or c in "._-" else "_" for c in str(rid))


_pending = {}


def _flush_pair(rid):
    if not rid:
        return
    try:
        res = cdp("Network.getResponseBody", requestId=rid)  # noqa: F821
    except Exception:
        _pending.pop(rid, None)
        return
    body = res.get("body", "")
    if res.get("base64Encoded"):
        try:
            body = base64.b64decode(body).decode("utf-8", errors="replace")
        except Exception:
            _pending.pop(rid, None)
            return
    d = BODIES / _safe_rid(rid)
    d.mkdir(parents=True, exist_ok=True)
    post = _pending.pop(rid, None)
    (d / "request.json").write_text(
        json.dumps({"id": rid, "body": post}, ensure_ascii=False), encoding="utf-8"
    )
    (d / "response.json").write_text(
        json.dumps({"body": body}, ensure_ascii=False), encoding="utf-8"
    )


def run():
    req_f = open(NET / "requests.jsonl", "w", encoding="utf-8", buffering=1)
    resp_f = open(NET / "responses.jsonl", "w", encoding="utf-8", buffering=1)

    print(f"[bh2api] navigating to {URL}", file=sys.stderr)
    new_tab(URL)  # noqa: F821
    active_session = _send({"meta": "session"}).get("session_id")
    print(f"[bh2api] active session: {active_session}", file=sys.stderr)

    try:
        wait_for_load(timeout=15)  # noqa: F821
    except Exception:
        pass

    print(f"[bh2api] capturing for {DURATION:.0f}s ...", file=sys.stderr)
    deadline = time.time() + DURATION
    req_n = resp_n = body_n = 0

    try:
        while time.time() < deadline:
            for ev in drain_events():  # noqa: F821
                if ev.get("session_id") != active_session:
                    continue
                m = ev.get("method", "")
                p = ev.get("params") or {}
                rid = p.get("requestId")
                if m == "Network.requestWillBeSent":
                    req_f.write(json.dumps({"method": m, "params": p}, ensure_ascii=False) + "\n")
                    req_n += 1
                    if CAPTURE_BODIES:
                        _pending[rid] = (p.get("request") or {}).get("postData")
                elif m == "Network.responseReceived":
                    resp_f.write(json.dumps({"method": m, "params": p}, ensure_ascii=False) + "\n")
                    resp_n += 1
                elif m == "Network.loadingFinished" and CAPTURE_BODIES:
                    _flush_pair(rid)
                    body_n += 1
            time.sleep(0.1)
    finally:
        # One last drain so events queued during the final sleep aren't lost
        for ev in drain_events():  # noqa: F821
            if ev.get("session_id") != active_session:
                continue
            m = ev.get("method", "")
            p = ev.get("params") or {}
            rid = p.get("requestId")
            if m == "Network.requestWillBeSent":
                req_f.write(json.dumps({"method": m, "params": p}, ensure_ascii=False) + "\n")
                req_n += 1
                if CAPTURE_BODIES:
                    _pending[rid] = (p.get("request") or {}).get("postData")
            elif m == "Network.responseReceived":
                resp_f.write(json.dumps({"method": m, "params": p}, ensure_ascii=False) + "\n")
                resp_n += 1
            elif m == "Network.loadingFinished" and CAPTURE_BODIES:
                _flush_pair(rid)
                body_n += 1
        req_f.close()
        resp_f.close()

    print(
        f"[bh2api] captured {req_n} requests, {resp_n} responses, {body_n} bodies -> {NET}",
        file=sys.stderr,
    )


run()
