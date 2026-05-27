export default {
  id: 'ws-delivered-result',
  scope: 'cross',
  severity: 'blocking',
  title: 'Results delivered via WebSocket, not HTTP response',
  match(run) {
    if (!run.wsFrames || run.wsFrames.length === 0) return [];
    const hits = [];
    const queuedPattern = /\b(status|state)["']?\s*[:=]\s*["']?(queued|processing|pending|in_progress|started)\b/i;

    for (const { request, response } of run.pairs) {
      if (!response || !response.body) continue;
      const body = String(response.body);
      if (!queuedPattern.test(body)) continue;
      const idMatch = body.match(/["']?(id|job_id|task_id|request_id|generation_id)["']?\s*[:=]\s*["']?([A-Za-z0-9_-]+)/);
      const id = idMatch ? idMatch[2] : null;
      const matchingFrame = id
        ? run.wsFrames.find((f) => f.payloadData && String(f.payloadData).includes(id))
        : run.wsFrames.length > 0 ? run.wsFrames[0] : null;
      if (!matchingFrame) continue;
      hits.push({
        request_id: request.id,
        endpoint: `${request.method} ${request.path}`,
        deferred_id: id,
        ws_frame_sample: String(matchingFrame.payloadData).slice(0, 120),
      });
    }
    return hits;
  },
  explanation:
    'The endpoint returns a deferred status (queued/processing/pending) and the ' +
    'final result arrives over a WebSocket frame matching the job id. HTTP polling ' +
    'against the same endpoint will not produce the result.',
  recommendation:
    'Subscribe to the WebSocket and match frames by job id, or poll the DOM/page ' +
    'state from inside the browser context.',
  execution_model: 'hybrid',
};
