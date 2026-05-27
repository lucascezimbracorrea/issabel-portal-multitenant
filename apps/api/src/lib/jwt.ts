import * as jose from 'jose';

const rawSecret = process.env.JWT_SECRET;
if (!rawSecret || rawSecret.length < 32) {
  throw new Error('JWT_SECRET env var is required and must be at least 32 characters');
}
const secret = new TextEncoder().encode(rawSecret);

export async function signToken(payload: { sub: number; role: string }) {
  return new jose.SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(payload.sub))
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyToken(token: string) {
  const { payload } = await jose.jwtVerify(token, secret);
  const sub = payload.sub ? Number(payload.sub) : NaN;
  const role = typeof payload.role === 'string' ? payload.role : '';
  if (!Number.isFinite(sub)) throw new Error('invalid');
  return { sub, role, purpose: typeof payload.purpose === 'string' ? payload.purpose : null, orgId: typeof payload.orgId === 'number' ? payload.orgId : Number(payload.orgId) || null, extensionId: typeof payload.extensionId === 'number' ? payload.extensionId : Number(payload.extensionId) || null };
}

/** Short-lived token for softphone app (15 min). */
export async function signSoftphoneToken(payload: {
  sub: number;
  orgId: number;
  extensionId?: number;
}) {
  return new jose.SignJWT({
    purpose: 'softphone',
    orgId: payload.orgId,
    ...(payload.extensionId ? { extensionId: payload.extensionId } : {}),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(payload.sub))
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
}

export async function verifySoftphoneToken(token: string) {
  const v = await verifyToken(token);
  if (v.purpose !== 'softphone' || !v.orgId) throw new Error('invalid_softphone_token');
  return { sub: v.sub, orgId: v.orgId, extensionId: v.extensionId };
}
