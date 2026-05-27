/** Format phone for display (digits only, optional +55). */
export function normalizePhoneDisplay(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 11) return `+55 ${d.slice(0, 2)} ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length >= 10) return `+${d}`;
  return raw;
}
