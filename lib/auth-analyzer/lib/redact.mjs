/**
 * Redact secret-looking values for safe inclusion in human-readable artifacts.
 * Keep first 4 + last 4 chars, replace middle with dots.
 */
export function redact(value, opts = {}) {
  if (value == null) return value;
  const s = String(value);
  if (s.length <= 12) return '***';
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
}

export function redactCookieString(cookieHeader) {
  if (!cookieHeader) return cookieHeader;
  return String(cookieHeader)
    .split(/;\s*/)
    .map((kv) => {
      const ix = kv.indexOf('=');
      if (ix <= 0) return kv;
      return `${kv.slice(0, ix)}=${redact(kv.slice(ix + 1))}`;
    })
    .join('; ');
}
