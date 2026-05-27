# Contributing to api-discover

Thanks for considering a contribution. This doc covers the most common cases.

## Adding a new auth-analyzer rule

The auth analyzer is intentionally simple to extend. One rule per file, one file per rule.

1. **Pick an id.** Lowercase, kebab-case, descriptive. Match the pattern: `<category>-<specifics>`. Examples: `cf-turnstile`, `csrf-laravel`, `ws-delivered-result`.

2. **Add the rule file.** Create `lib/auth-analyzer/rules/<id>.mjs`. Export a default object:

   ```js
   export default {
     id: 'my-new-pattern',
     scope: 'request',                       // request | response | cookie | ws-frame | cross
     severity: 'blocking',                   // blocking | warn | ok | info
     title: 'Short human-readable title',
     match(run) {
       const hits = [];
       for (const req of run.requests) {
         if (/* detection logic */) {
           hits.push({ request_id: req.id, endpoint: `${req.method} ${req.path}`, /* evidence */ });
         }
       }
       return hits;
     },
     explanation: 'Why this is a problem (or a green flag).',
     recommendation: 'What the user should do about it.',
     execution_model: 'http_only',           // http_only | in_browser | ui_driven | hybrid
   };
   ```

3. **Register the rule.** Add the import + entry to `lib/auth-analyzer/rules/index.mjs`. Keep blocking rules near the top so they're evaluated first in the verdict aggregation.

4. **Add a fixture.** Add a block to `test/fixtures/build-fixtures.mjs` that produces a minimal CDP capture which should trigger your rule. Then add an entry to the `EXPECT` table in `test/analyzer.test.mjs` declaring the expected rule id, severity, and verdict.

5. **Regenerate + test.**

   ```bash
   node test/fixtures/build-fixtures.mjs
   npm test
   ```

6. **PR conventions.** One rule per PR. Title prefix `analyzer:`. Include a one-paragraph note in the PR description with a real-world example of the pattern (a site you saw it on, sanitized).

## Adding a synthetic example

`examples/` is for end-to-end demos against synthetic targets (httpbin.org, postman-echo, your own local app). PRs adding examples against third-party SaaS will not be accepted to keep the repo ToS-clean.

## Reporting bugs

Open an issue with:

- What you ran (full command)
- What you expected
- What you got (paste output + relevant log lines)
- The target type (your own app / public API / which SaaS)

Do not paste captured tokens or cookies in issues. Redact first.

## Code style

- ESM (`.mjs`), no transpilation
- No external runtime dependencies (vendored upstream is fine, npm deps are not)
- Two-space indent, single quotes, semicolons
- Run `npm run lint:secrets` before submitting

## License

By contributing, you agree your contributions are licensed under MIT.
