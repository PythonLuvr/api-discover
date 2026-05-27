export default {
  id: 'tracing-noise',
  scope: 'request',
  severity: 'info',
  title: 'Distributed-tracing headers detected (safe to drop)',
  match(run) {
    const tracingHeaders = ['baggage', 'sentry-trace', 'traceparent', 'tracestate', 'x-request-id', 'x-trace-id'];
    const counts = {};
    for (const req of run.requests) {
      for (const h of tracingHeaders) {
        if (req.headers[h]) counts[h] = (counts[h] || 0) + 1;
      }
    }
    const hits = [];
    for (const [h, n] of Object.entries(counts)) {
      hits.push({ header: h, occurrences: n });
    }
    return hits;
  },
  explanation:
    'These headers carry distributed-tracing context (Sentry, OpenTelemetry, ' +
    'request IDs). They are observed but not required for replay. Safe to drop.',
  recommendation:
    'In replay client: do NOT forward these headers. They will only pollute the ' +
    "target's observability with traces of your scraper.",
  execution_model: 'http_only',
};
