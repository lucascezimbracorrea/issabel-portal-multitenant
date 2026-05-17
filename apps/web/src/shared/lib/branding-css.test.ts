import { describe, expect, it } from 'vitest';
import { normalizeHslComponents } from './branding-css';

describe('normalizeHslComponents', () => {
  it('accepts hsl() strings', () => {
    expect(normalizeHslComponents('hsl(173, 58%, 39%)')).toBe('173 58% 39%');
  });

  it('accepts raw HSL components', () => {
    expect(normalizeHslComponents('173 58% 39%')).toBe('173 58% 39%');
  });

  it('rejects invalid values', () => {
    expect(normalizeHslComponents('not-a-color')).toBeUndefined();
    expect(normalizeHslComponents(123)).toBeUndefined();
  });
});
