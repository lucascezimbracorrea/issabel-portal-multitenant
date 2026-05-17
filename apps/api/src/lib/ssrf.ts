/** Block obvious private IPs in URLs for outbound HTTP rules. */
export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local')) return true;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(h)) return true;
  if (h === '0.0.0.0' || h === '[::1]' || h === '127.0.0.1') return true;
  return false;
}
