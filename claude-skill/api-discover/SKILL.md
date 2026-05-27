---
name: api-discover
description: Reverse-engineer a third-party website's HTTP API into an OpenAPI 3.1 spec, a typed client, and an upfront auth-feasibility verdict. Drive the site via browser-harness while api-discover captures CDP Network traffic. Use when the user wants to extract the API surface of a site (admin panels, SaaS dashboards, client portals) so future work can hit endpoints directly instead of clicking through the UI.
license: MIT
allowed-tools: Bash, PowerShell, Read, Write, Edit, Grep, Glob
---

# api-discover

**What:** drive a website through a brief, capture every XHR it fires, emit OpenAPI 3.1 + `client.mjs` + auth-feasibility verdict.

**Cost:** $0 (local tools only, no LLM calls outside this session).

**Install:** `git clone https://github.com/PythonLuvr/api-discover && cd api-discover && ./install.sh` (or `.\install.ps1` on Windows). The `api-discover` binary is then on PATH.

---

## Inputs from the user

You need three things before starting. If any is missing, ask once:

1. **Target URL.** The page where the interesting XHRs fire (after login, after navigating to the right view).
2. **Brief.** What flows to drive. Examples: "upscale one image, download the result, view history, delete one item." Specificity bounds the spec: every endpoint must be exercised to be captured.
3. **Auth status.** Is the user already signed in on the running browser, or do they need to log in first?

**Out of scope of this skill:** typing credentials. Never do that from a screenshot or saved memory. If login is needed, hand the keyboard to the user.

---

## Pre-flight (fail fast)

```
api-discover doctor
```

This checks: Node 18+, browser-harness on PATH, Python on PATH, CDP port 9222 responding, all bundled files present.

If port 9222 is not live, doctor prints the exact launch command for your platform. Run it, sign into the target, then come back.

---

## Two capture modes

### MODE A: canned (new tab, fresh navigation)

Use when: the target page is reachable directly by URL, no pre-configuration needed.

```
api-discover capture https://target.example/page -o ./out/<slug> -d 90
```

The capture window is `-d` seconds. During that window, drive the flows from the brief via `browser-harness -c "..."` commands. Examples:

```
browser-harness -c "click_at_role('button', name='Upscale')"
browser-harness -c "fill_at_label('Email', '<test@example.com>')"
browser-harness -c "wait_for_element(role='status', text='Complete')"
```

Run `browser-harness --help` to confirm the actual command surface. Verify, do not guess.

### MODE B: inline / escape hatch (currently-active tab, no re-navigation)

Use when: the brief requires a tab already configured by hand (multi-step form, modal state, gear-icon settings). The canned mode would re-navigate and destroy that state.

```
# 1) Find the tab id
browser-harness -c "import json; print(json.dumps(list_tabs()))"

# 2) Capture without re-navigation, optionally with a trigger action
api-discover inline --tab-id <id> --trigger "click_at_role('button', name='Generate')" -o ./out/<slug>
```

---

## During the capture window

While capture is running, drive the flows from the brief. Narrate each step in chat so the user can interject mid-flight. Keep updates one line each:

> "[1/4] Opening listing page" then "[2/4] Clicked first item" then "[3/4] Triggered upscale" then "[4/4] Waited for completion."

Mid-flight extra guidance from the user is expected. Treat their messages as authoritative additions to the brief.

---

## After capture: the report walk

1. **Read `auth-analysis.md` first.** It is the upfront verdict on whether HTTP-only replay will work. If it says BLOCKED, do not promise an HTTP-only client without addressing the blocker.

2. **Read `api-spec/report.md` next.** It has a curl example per endpoint. Do not summarize what was not captured.

3. **Show the user the endpoint table.** Method, Path, Samples, Status, Confidence. Single-sample or low-confidence endpoints are first candidates to re-exercise.

4. **Pipe-test ONE real call** through the generated `api-spec/client.mjs` before declaring done. "spec emitted" is not done. "I called `upscaleImage()` against the real target and got a real upscaled image back" is done.

5. **Document the auth pattern.** Cookies, headers, CSRF/Turnstile/tenant tokens required for replay. Future-you needs this when auth breaks.

---

## What "done" looks like

Claim the job complete only when ALL of these are true:

1. `auth-analysis.md` exists and you have read it.
2. `api-spec/report.md` lists every endpoint the brief exercised.
3. A `client.{mjs,py,ts}` exists wrapping those endpoints with sane defaults.
4. You ran that client end-to-end against the real target and observed a real side effect.
5. Auth path is documented in your own notes (cookies, headers, tokens).

Anything less is partial. Say "I have X, missing Y."

---

## Operator rules specific to this work

- **Scope the flow first.** Ask one clarifying question if the brief is vague. "Exercise the whole site" produces noise; "log in, search, add to cart, checkout" produces gold.
- **Verify before claiming.** Run `api-discover doctor` before invoking capture. Do not assume tools are wired up.
- **Trust the auth analyzer.** If it says BLOCKED, the recommendation is the path forward. Do not grind on header diffs hoping a Turnstile token will replay.
- **Pipe-test or it is not done.** No exceptions. A spec without a passing real call is a draft.

---

## Common targets and what to exercise

- **Admin dashboards.** List, view one item, create one, delete one. Heavy on GraphQL on modern stacks.
- **Project boards (Monday, Asana, Linear-style).** Open board, move card, query items, comment.
- **AI image/video generators.** Upscale or generate one (low cost), download result, view history. Expect CAPTCHAs and WebSocket-delivered results.
- **Prompt-management tools.** List prompts, view one, create draft.
- **Analytics dashboards.** Open one report, change filter, export. Often hits GraphQL.

Output dir convention: `out/<client-or-slug>/` so traces do not collide.
