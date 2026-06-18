// Parse a field that may hold a single legacy value ("DA-01") or a JSON array
// of values ('["DA-01","DA-02"]'). Always returns an array of strings.
export function parseMulti(v) {
  if (!v) return []
  if (typeof v === 'string' && v.charAt(0) === '[') {
    try { return JSON.parse(v).map(String) } catch (_) {}
  }
  return [String(v)]
}

// Human-readable display: "DA-01, DA-02" (empty → "").
export function formatMulti(v) {
  return parseMulti(v).join(', ')
}
