export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    let path = u.pathname || '/';
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    const qs = u.search || '';
    return `${u.origin}${path}${qs}`;
  } catch {
    return (raw || '').replace(/#.*$/, '').replace(/\/+$/, '');
  }
}
