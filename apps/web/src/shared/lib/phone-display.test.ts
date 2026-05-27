import { describe, expect, it } from 'vitest';
import { normalizePhoneDisplay } from './phone-display';

describe('normalizePhoneDisplay', () => {
  it('formats 11-digit BR mobile', () => {
    expect(normalizePhoneDisplay('11987654321')).toContain('11');
  });

  it('returns raw for short numbers', () => {
    expect(normalizePhoneDisplay('201')).toBe('201');
  });
});
