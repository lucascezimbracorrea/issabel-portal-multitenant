/**
 * IssabelUrlPort — builds PBX UI URLs without coupling feature code to env parsing.
 * Prefer same-origin relative paths in production so `issabelSession` is sent to the iframe.
 */
export function issabelIndexPhpUrl(menu: string, options?: { orgIssabelBaseUrl?: string | null }): string {
  const raw = (options?.orgIssabelBaseUrl ?? import.meta.env.VITE_ISSABEL_BASE_URL ?? '').trim().replace(/\/$/, '');
  const m = encodeURIComponent(menu);
  if (!raw) return `/index.php?menu=${m}`;
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    const base = new URL(raw.endsWith('/') ? raw : `${raw}/`);
    const u = new URL('index.php', base);
    u.searchParams.set('menu', menu);
    return u.toString();
  }
  const prefix = raw.startsWith('/') ? raw : `/${raw}`;
  return `${prefix}/index.php?menu=${m}`.replace(/\/{2,}/g, '/');
}
