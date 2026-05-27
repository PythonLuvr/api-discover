# Example: httpbin.org/anything

`httpbin.org/anything` echoes whatever you send. Useful as a sanity-check target: zero auth, predictable responses, no ToS to violate.

## Run it

```bash
# Make sure the doctor is happy first.
api-discover doctor

# Capture 30 seconds of httpbin traffic.
api-discover capture https://httpbin.org/anything -o ./out/httpbin -d 30

# While the capture window is open, hit a few endpoints by hand:
#   - https://httpbin.org/get?q=test
#   - https://httpbin.org/post (any client)
#   - https://httpbin.org/headers
```

## What you should see

```
out/httpbin/
├── api-spec/
│   ├── openapi.yaml
│   ├── client.mjs
│   ├── report.html
│   └── report.md
├── auth-analysis.md       # expect: VERDICT: FEASIBLE
└── cdp/network/...
```

## Expected verdict

```
VERDICT: FEASIBLE
Recommended execution model: http_only
0 blocking, 0 warn, 0 ok, 0 info
```

httpbin is unauthenticated and uses no CSRF / CAPTCHAs / tenant scoping, so the analyzer should produce a clean "FEASIBLE" verdict. If it doesn't, file an issue.
