# Security and Acceptable Use

`api-discover` is a network-capture and API-discovery tool. It watches one of your real browser sessions, writes a typed client from what it observes, and tells you which captured endpoints can be replayed outside the browser. It is functionally similar to mitmproxy, Charles Proxy, Burp Suite, Postman's request capture, and Browserbase's `browser-to-api`. Like those tools, it is dual-use.

By using this software you agree to the terms below.

## Acceptable use

Use `api-discover` on:

- Your own applications and infrastructure.
- Client surfaces where you have written consent from the surface owner.
- Genuinely public APIs that document or permit programmatic access.
- Synthetic targets you control (`httpbin.org`, your own local app, etc).

Do not use `api-discover` on systems where you lack authorization.

## What this tool does not do

- It does not bypass technical access controls. It identifies them in the capture and recommends you stop.
- It does not solve CAPTCHAs (Turnstile, hCaptcha, reCAPTCHA). When it sees one, it flags the endpoint as `BLOCKING` and points you to an `in_browser` execution model.
- It does not type, store, or transmit credentials. You sign into the target site by hand in your own browser.
- It does not exfiltrate captured data anywhere. All output is written to a local `out/` directory.

## Responsibility

You are responsible for what you point this at. Terms of service vary by target. Some sites permit reading their network traffic and writing clients against it. Others prohibit any automated access. Read the ToS of the system you're capturing against, and make your own call.

Reverse-engineering for interoperability is protected in many jurisdictions but not all, and ToS contracts often impose additional restrictions on top of statutory law. This tool does not give legal advice. If you are uncertain, ask a lawyer who knows your jurisdiction.

The maintainers of `api-discover` are not responsible for how you use it.

## Reporting a vulnerability in `api-discover` itself

If you find a security issue in the tool (path traversal in the output writer, command injection in the harness, unsafe deserialization of CDP frames, anything that could harm a user of the tool itself), please open a GitHub security advisory at:

https://github.com/PythonLuvr/api-discover/security/advisories/new

Do not file a public issue for vulnerabilities. Give the maintainers a reasonable window to ship a fix before disclosure.

## Disclaimer

This software is provided as-is under the MIT license. Use at your own discretion. No warranty, express or implied. The license file is the source of truth on liability terms.
