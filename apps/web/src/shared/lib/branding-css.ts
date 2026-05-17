export function normalizeHslComponents(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  if (s.startsWith('hsl('))
    return s
      .replace(/^hsl\(|\)$/g, '')
      .replaceAll(',', ' ')
      .trim()
      .replace(/\s+/g, ' ');
  if (/^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/.test(s)) return s;
  return undefined;
}

const TOKEN_KEYS = [
  'primary',
  'primaryForeground',
  'accent',
  'ring',
  'background',
  'foreground',
  'card',
  'sidebar',
  'sidebarForeground',
] as const;

export type BrandingToken = (typeof TOKEN_KEYS)[number];

/** Maps camelCase appearance keys to CSS variable names used in `index.css`. */
function cssVarName(key: string): string | undefined {
  const map: Record<string, string> = {
    primary: '--primary',
    primaryForeground: '--primary-foreground',
    accent: '--accent',
    ring: '--ring',
    background: '--background',
    foreground: '--foreground',
    card: '--card',
    sidebar: '--sidebar',
    sidebarForeground: '--sidebar-foreground',
  };
  return map[key];
}

export function applyAppearanceCssVars(appearance: Record<string, unknown>, target: HTMLElement = document.documentElement) {
  for (const key of TOKEN_KEYS) {
    const v = appearance[key];
    const hsl = normalizeHslComponents(v);
    const varName = cssVarName(key);
    if (hsl && varName) target.style.setProperty(varName, hsl);
  }
}

export function clearBrandingCssVars(target: HTMLElement = document.documentElement) {
  for (const key of TOKEN_KEYS) {
    const varName = cssVarName(key);
    if (varName) target.style.removeProperty(varName);
  }
}
