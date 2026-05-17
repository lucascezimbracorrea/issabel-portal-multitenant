import * as jose from 'jose';
const rawSecret = process.env.JWT_SECRET;
if (!rawSecret || rawSecret.length < 32) {
    throw new Error('JWT_SECRET env var is required and must be at least 32 characters');
}
const secret = new TextEncoder().encode(rawSecret);
export async function signToken(payload) {
    return new jose.SignJWT({ role: payload.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(String(payload.sub))
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret);
}
export async function verifyToken(token) {
    const { payload } = await jose.jwtVerify(token, secret);
    const sub = payload.sub ? Number(payload.sub) : NaN;
    const role = typeof payload.role === 'string' ? payload.role : '';
    if (!Number.isFinite(sub))
        throw new Error('invalid');
    return { sub, role };
}
