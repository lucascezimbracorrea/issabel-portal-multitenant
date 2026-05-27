import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './crypto-util.js';

describe('crypto-util', () => {
  const prev = process.env.CREDENTIALS_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-key-min-16-chars!!';
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    else process.env.CREDENTIALS_ENCRYPTION_KEY = prev;
  });

  it('round-trips with enc prefix', () => {
    const stored = encryptSecret('sip-secret-123');
    expect(stored.startsWith('enc:')).toBe(true);
    expect(decryptSecret(stored)).toBe('sip-secret-123');
  });

  it('uses plain prefix when no key', () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    const stored = encryptSecret('x');
    expect(stored).toBe('plain:x');
    expect(decryptSecret(stored)).toBe('x');
  });
});
