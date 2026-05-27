"""
Inline capture — runs on the CURRENTLY active tab, no re-navigation.

Use this when bh2api's new-tab navigation would reset form state you've
configured by hand (model picker, gear settings, multi-step form, etc.).

Required env:
  BH2API_OUT          absolute output dir (will create cdp/network/ inside it)
  BH2API_GEN_WAIT_S   seconds to wait for the operation to settle (default 90)

Usage:
  # 1) configure your form in the browser by hand
  # 2) find the target tab id:
  browser-harness -c "import json; print(json.dumps(list_tabs()))"
  # 3) edit the DRIVE block below to perform your trigger action
  # 4) run:
  export BH2API_OUT=$HOME/.tmp/bh2api/my-capture
  mkdir -p $BH2API_OUT/cdp/network
  browser-harness -c "switch_tab('<targetId>'); import time; time.sleep(0.5); exec(open('scripts/inline_capture.py', encoding='utf-8').read())"
  node ~/.agents/skills/browser-to-api/scripts/discover.mjs --run $BH2API_OUT

CRITICAL invariants (don't break these):
  - cdp("Network.enable") MUST be called explicitly. Switching tabs doesn't
    enable Network.* event delivery for the new session. Without it your
    requests.jsonl will be empty even though the page is firing XHRs.
  - The drain loop MUST start BEFORE the trigger action. Network.getResponseBody
    only works while Chrome still holds the body. If you click first and drain
    later, you'll get bodies=0.
  - DO NOT filter by session_id. Nested frames, service workers, and the
    backbone WebSocket each carry different session_ids; filtering drops them.
"""
import base64
import json
import os
import time
from collections import Counter
from pathlib import Path

OUT = Path(os.environ["BH2API_OUT"]).resolve()
GEN_WAIT = int(os.environ.get("BH2API_GEN_WAIT_S", "90"))

NET = OUT / "cdp" / "network"
BODIES = NET / "bodies"
BODIES.mkdir(parents=True, exist_ok=True)


# ---- 1) ensure Network domain is on for the current session
cdp("Network.enable")  # noqa: F821
list(drain_events())   # noqa: F821 — drain garbage queued before we started


# ---- 2) set up file writers + drain function
req_f = open(NET / "requests.jsonl", "w", encoding="utf-8", buffering=1)
resp_f = open(NET / "responses.jsonl", "w", encoding="utf-8", buffering=1)
pending = {}
counts = Counter()


def _safe(rid):
    return "".join(c if c.isalnum() or c in "._-" else "_" for c in str(rid))


def flush(rid):
    if not rid:
        return
    try:
        res = cdp("Network.getResponseBody", requestId=rid)  # noqa: F821
    except Exception:
        pending.pop(rid, None)
        return
    body = res.get("body", "")
    if res.get("base64Encoded"):
        try:
            body = base64.b64decode(body).decode("utf-8", errors="replace")
        except Exception:
            pending.pop(rid, None)
            return
    d = BODIES / _safe(rid)
    d.mkdir(parents=True, exist_ok=True)
    post = pending.pop(rid, None)
    (d / "request.json").write_text(
        json.dumps({"id": rid, "body": post}, ensure_ascii=False), encoding="utf-8"
    )
    (d / "response.json").write_text(
        json.dumps({"body": body}, ensure_ascii=False), encoding="utf-8"
    )
    counts["body"] += 1


def drain():
    for ev in drain_events():  # noqa: F821
        m = ev.get("method", "")
        p = ev.get("params") or {}
        rid = p.get("requestId")
        if m == "Network.requestWillBeSent":
            req_f.write(json.dumps({"method": m, "params": p}, ensure_ascii=False) + "\n")
            counts["req"] += 1
            pending[rid] = (p.get("request") or {}).get("postData")
        elif m == "Network.responseReceived":
            resp_f.write(json.dumps({"method": m, "params": p}, ensure_ascii=False) + "\n")
            counts["resp"] += 1
        elif m == "Network.loadingFinished":
            flush(rid)


# ---- 3) DRIVE THE UI HERE
# Replace this block with whatever your target needs. Example: click a
# Submit button found by text content.
#
# layout = js("""
#   const b = Array.from(document.querySelectorAll('button'))
#                  .find(b => b.textContent.trim() === 'Submit');
#   if (!b) return null;
#   const r = b.getBoundingClientRect();
#   return {x: r.x + r.width/2, y: r.y + r.height/2};
# """)
# if not layout:
#     raise SystemExit("could not find Submit button — DOM probe failed")
# click_at_xy(layout["x"], layout["y"])  # noqa: F821

# (If your trigger is purely backend, e.g. a polling refresh, skip the
# click and just let the loop below run.)


# ---- 4) drain in tight loop until idle or timeout
submit_at = time.time()
deadline = submit_at + GEN_WAIT
last_progress = submit_at
while time.time() < deadline:
    before = counts["resp"]
    drain()
    if counts["resp"] > before:
        last_progress = time.time()
    # Heuristic: if idle for 6s after we've seen the typical poll volume,
    # the operation is probably done. Tune for your target.
    if counts["resp"] > 8 and (time.time() - last_progress) > 6:
        break
    time.sleep(0.15)

# Final settle to catch tail bodies
for _ in range(15):
    drain()
    time.sleep(0.4)

req_f.close()
resp_f.close()
print(f"[inline] DONE — req={counts['req']} resp={counts['resp']} body={counts['body']}")
