/** Normalize phone for caller-id matching (digits only, last 11 for BR). */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.length > 11) return digits.slice(-11);
  return digits;
}
