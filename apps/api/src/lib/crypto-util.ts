import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

function encryptionKey(): string | null {
  const k = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();
  return k && k.length >= 16 ? k : null;
}

/** Encrypt sensitive value (e.g. SIP password). Returns `plain:` prefix if no key configured. */
export function encryptSecret(plain: string): string {
  const keyStr = encryptionKey();
  if (!keyStr || !plain) return plain ? `plain:${plain}` : '';
  const key = deriveKey(keyStr);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (stored.startsWith('plain:')) return stored.slice(6);
  if (!stored.startsWith('enc:')) return stored;
  const keyStr = encryptionKey();
  if (!keyStr) return null;
  const parts = stored.split(':');
  if (parts.length !== 4) return null;
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const data = Buffer.from(parts[3], 'base64');
  const key = deriveKey(keyStr);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
