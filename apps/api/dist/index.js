import 'dotenv/config';
import { serve } from '@hono/node-server';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { and, asc, count as sqlCount, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie } from 'hono/cookie';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from './db/client.js';
import { initSchema } from './db/init.js';
import * as schema from './db/schema.js';
import { signToken, verifyToken } from './lib/jwt.js';
import { rateLimitLogin } from './lib/rate-limit.js';
import { isBlockedHost } from './lib/ssrf.js';
import { fetchCdrHistory, globalCdrConfigFromEnv, parseCdrConfig } from './lib/issabel-cdr.js';
import { buildPlatformOverview } from './lib/platform-metrics.js';
import { resolveTelephonyOverview } from './lib/telephony.js';
import { mergeIssabelPbxApiPatch, parseIssabelPbxApiJson, redactIssabelPbxApiJson, syncExtensionViaIssabelPbxApi, } from './lib/issabel-pbx-api.js';
await initSchema();
const EXT_CREATE_CORE = new Set(['organizationId', 'number', 'displayName', 'spaceId', 'metadata']);
const EXT_PATCH_CORE = new Set(['number', 'displayName', 'spaceId', 'metadata']);
function safeParseJsonObject(raw) {
    if (!raw?.trim())
        return {};
    try {
        const j = JSON.parse(raw);
        return j !== null && typeof j === 'object' && !Array.isArray(j) ? j : {};
    }
    catch {
        return {};
    }
}
function parseExtensionCreateBody(raw) {
    const base = z.object({
        organizationId: z.number(),
        number: z.string().min(1).max(32),
        displayName: z.string().min(1).max(128),
        spaceId: z.number().nullable().optional(),
        metadata: z.record(z.unknown()).optional(),
    });
    const parsed = base.safeParse(raw);
    if (!parsed.success)
        return { ok: false, err: parsed.error };
    const obj = raw;
    const meta = { ...(parsed.data.metadata ?? {}) };
    for (const [k, v] of Object.entries(obj)) {
        if (!EXT_CREATE_CORE.has(k))
            meta[k] = v;
    }
    const metadataStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : null;
    const { organizationId, number, displayName, spaceId } = parsed.data;
    return { ok: true, organizationId, number, displayName, spaceId, metadataStr };
}
const extensionPatchCoreZ = z.object({
    number: z.string().min(1).max(32).optional(),
    displayName: z.string().min(1).max(128).optional(),
    spaceId: z.number().nullable().optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
});
function parseExtensionPatchBody(raw, existingMetaStr) {
    const obj = raw;
    const patchCore = extensionPatchCoreZ.safeParse(obj);
    if (!patchCore.success)
        return { ok: false, err: patchCore.error };
    const next = { ...safeParseJsonObject(existingMetaStr) };
    for (const [k, v] of Object.entries(obj)) {
        if (EXT_PATCH_CORE.has(k))
            continue;
        next[k] = v;
    }
    if (patchCore.data.metadata !== undefined && patchCore.data.metadata !== null) {
        Object.assign(next, patchCore.data.metadata);
    }
    const metadataStr = Object.keys(next).length > 0 ? JSON.stringify(next) : null;
    return { ok: true, core: patchCore.data, metadataStr };
}
async function syncPortalExtensionToIssabel(orgRow, extRow, mode) {
    const cfg = parseIssabelPbxApiJson(orgRow.issabelPbxApi ?? undefined);
    if (!cfg)
        return extRow;
    const meta = safeParseJsonObject(extRow.metadata);
    const sipSecret = typeof meta.sipPassword === 'string' ? meta.sipPassword : '';
    const sync = await syncExtensionViaIssabelPbxApi({
        cfg,
        extensionNumber: extRow.number,
        displayName: extRow.displayName,
        sipSecret,
        mode,
    });
    const nextMeta = {
        ...meta,
        issabelSync: { ...sync, at: new Date().toISOString() },
    };
    const nextSource = sync.ok ? 'synced' : extRow.source;
    await db
        .update(schema.extensions)
        .set({
        metadata: JSON.stringify(nextMeta),
        ...(nextSource !== extRow.source ? { source: nextSource } : {}),
    })
        .where(eq(schema.extensions.id, extRow.id));
    const [fresh] = await db.select().from(schema.extensions).where(eq(schema.extensions.id, extRow.id));
    return fresh ?? extRow;
}
const app = new Hono();
app.use('*', cors({
    origin: (origin) => {
        if (!origin)
            return null;
        const allowed = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
            .split(',')
            .map((s) => s.trim());
        return allowed.includes(origin) ? origin : null;
    },
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
}));
app.onError((err, c) => {
    console.error('[error]', err);
    return c.json({ error: 'internal_server_error' }, 500);
});
const COOKIE = 'portal_session';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSessionUser(c) {
    const auth = c.req.header('authorization');
    let token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (!token) {
        token = getCookie(c, COOKIE);
    }
    if (!token)
        return null;
    try {
        const { sub, role } = await verifyToken(token);
        const [u] = await db.select().from(schema.users).where(eq(schema.users.id, sub));
        if (!u)
            return null;
        return { ...u, tokenRole: role };
    }
    catch {
        return null;
    }
}
async function membershipForOrg(userId, organizationId) {
    const [m] = await db
        .select()
        .from(schema.organizationMembers)
        .where(and(eq(schema.organizationMembers.userId, userId), eq(schema.organizationMembers.organizationId, organizationId)));
    return m ?? null;
}
async function canReadOrg(u, organizationId) {
    if (u.role === 'platform_admin')
        return true;
    return !!(await membershipForOrg(u.id, organizationId));
}
async function canWriteOrg(u, organizationId) {
    if (u.role === 'platform_admin')
        return true;
    const m = await membershipForOrg(u.id, organizationId);
    if (!m)
        return false;
    return m.role === 'org_admin' || m.role === 'org_operator';
}
async function canAdminOrg(u, organizationId) {
    if (u.role === 'platform_admin')
        return true;
    const m = await membershipForOrg(u.id, organizationId);
    return m?.role === 'org_admin';
}
const loginSchema = z.object({
    email: z.string().min(1),
    password: z.string().min(1),
});
app.post('/auth/login', async (c) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    if (!rateLimitLogin(ip)) {
        return c.json({ error: 'rate_limited' }, 429);
    }
    const parsed = loginSchema.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const { email, password } = parsed.data;
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        return c.json({ error: 'invalid_credentials' }, 401);
    }
    const token = await signToken({ sub: user.id, role: user.role });
    setCookie(c, COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
    });
    return c.json({
        token,
        user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
    });
});
app.post('/auth/logout', (c) => {
    setCookie(c, COOKIE, '', { path: '/', maxAge: 0 });
    return c.json({ ok: true });
});
app.get('/public/branding-by-host', async (c) => {
    const host = c.req.query('host')?.toLowerCase() ?? '';
    if (!host)
        return c.json({ organizationId: null, appearance: {} });
    const [org] = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.customDomain, host));
    if (!org)
        return c.json({ organizationId: null, appearance: {} });
    let appearance = {};
    try {
        appearance = org.appearance ? JSON.parse(org.appearance) : {};
    }
    catch {
        appearance = {};
    }
    return c.json({ organizationId: org.id, tradeName: org.tradeName ?? org.name, appearance });
});
app.get('/me', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const memberships = await db
        .select()
        .from(schema.organizationMembers)
        .where(eq(schema.organizationMembers.userId, u.id));
    const orgIds = u.role === 'platform_admin'
        ? (await db.select({ id: schema.organizations.id }).from(schema.organizations)).map((r) => r.id)
        : memberships.map((m) => m.organizationId);
    return c.json({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl ?? null,
        role: u.role,
        organizationIds: orgIds,
    });
});
const mePatchSchema = z.object({
    displayName: z.string().min(1).max(128).optional(),
    avatarUrl: z.union([z.string().max(512), z.literal(''), z.null()]).optional(),
});
app.patch('/me', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = mePatchSchema.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (b.displayName === undefined && b.avatarUrl === undefined) {
        return c.json({ error: 'no_fields' }, 400);
    }
    const set = {};
    if (b.displayName !== undefined)
        set.displayName = b.displayName;
    if (b.avatarUrl !== undefined) {
        const v = b.avatarUrl;
        set.avatarUrl = v === '' || v === null ? null : v;
    }
    await db.update(schema.users).set(set).where(eq(schema.users.id, u.id));
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    const memberships = await db
        .select()
        .from(schema.organizationMembers)
        .where(eq(schema.organizationMembers.userId, row.id));
    const orgIds = row.role === 'platform_admin'
        ? (await db.select({ id: schema.organizations.id }).from(schema.organizations)).map((r) => r.id)
        : memberships.map((m) => m.organizationId);
    return c.json({
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl ?? null,
        role: row.role,
        organizationIds: orgIds,
    });
});
const listQuery = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(10),
    sort: z.string().optional(),
    q: z.string().optional(),
});
const orgListQuery = listQuery.extend({
    orgKind: z.enum(['pabx', 'dialer']).optional(),
    status: z.enum(['active', 'inactive', 'all']).optional(),
});
app.get('/organizations', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const q = orgListQuery.safeParse(c.req.query());
    if (!q.success)
        return c.json({ error: q.error.flatten() }, 400);
    const { page, pageSize, sort, q: search, orgKind, status } = q.data;
    const offset = (page - 1) * pageSize;
    const conditions = [];
    if (u.role !== 'platform_admin') {
        const mids = await db
            .select({ oid: schema.organizationMembers.organizationId })
            .from(schema.organizationMembers)
            .where(eq(schema.organizationMembers.userId, u.id));
        const allowed = mids.map((m) => m.oid);
        if (allowed.length === 0)
            return c.json({ items: [], total: 0, page, pageSize });
        conditions.push(inArray(schema.organizations.id, allowed));
    }
    if (search) {
        conditions.push(or(like(schema.organizations.name, `%${search}%`), like(schema.organizations.tradeName, `%${search}%`)));
    }
    if (orgKind) {
        conditions.push(eq(schema.organizations.orgKind, orgKind));
    }
    if (status === 'active') {
        conditions.push(eq(schema.organizations.active, true));
    }
    else if (status === 'inactive') {
        conditions.push(eq(schema.organizations.active, false));
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;
    const orderCol = sort?.startsWith('name:desc')
        ? desc(schema.organizations.name)
        : asc(schema.organizations.name);
    let itemsQ = db.select().from(schema.organizations).orderBy(orderCol).limit(pageSize).offset(offset);
    if (whereClause)
        itemsQ = itemsQ.where(whereClause);
    const items = await itemsQ;
    let countQ = db.select({ count: sql `count(*)` }).from(schema.organizations);
    if (whereClause)
        countQ = countQ.where(whereClause);
    const [{ count }] = await countQ;
    const ids = items.map((o) => o.id);
    const spaceByOrg = new Map();
    const extByOrg = new Map();
    if (ids.length > 0) {
        const spaceAgg = await db
            .select({ organizationId: schema.spaces.organizationId, n: sqlCount() })
            .from(schema.spaces)
            .where(inArray(schema.spaces.organizationId, ids))
            .groupBy(schema.spaces.organizationId);
        for (const row of spaceAgg)
            spaceByOrg.set(row.organizationId, row.n);
        const extAgg = await db
            .select({ organizationId: schema.extensions.organizationId, n: sqlCount() })
            .from(schema.extensions)
            .where(inArray(schema.extensions.organizationId, ids))
            .groupBy(schema.extensions.organizationId);
        for (const row of extAgg)
            extByOrg.set(row.organizationId, row.n);
    }
    const listItems = items.map((o) => {
        let logoUrl = null;
        if (o.appearance) {
            try {
                const ap = JSON.parse(o.appearance);
                if (typeof ap.logoUrl === 'string' && ap.logoUrl.trim())
                    logoUrl = ap.logoUrl.trim();
            }
            catch {
                /* ignore */
            }
        }
        if (!logoUrl) {
            logoUrl = `https://ui-avatars.com/api/?size=128&background=0f766e&color=fff&name=${encodeURIComponent(o.tradeName ?? o.name)}`;
        }
        const { appearance: _appearance, ...rest } = o;
        const extUsed = extByOrg.get(o.id) ?? 0;
        return {
            ...rest,
            issabelPbxApi: redactIssabelPbxApiJson(o.issabelPbxApi ?? undefined),
            logoUrl,
            spacesCount: spaceByOrg.get(o.id) ?? 0,
            extensionsCount: extUsed,
            extensionsUsed: extUsed,
            extensionsLimit: o.extensionsLimit ?? null,
            channelsLimit: o.channelsLimit ?? null,
            channelsUsed: 0,
            diskQuotaGb: o.diskQuotaGb ?? null,
            orgKind: o.orgKind,
            onlineCallsEstimate: 0,
        };
    });
    return c.json({ items: listItems, total: count, page, pageSize });
});
app.get('/organizations/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, id));
    if (!org)
        return c.json({ error: 'not_found' }, 404);
    if (u.role !== 'platform_admin') {
        const [m] = await db
            .select()
            .from(schema.organizationMembers)
            .where(and(eq(schema.organizationMembers.userId, u.id), eq(schema.organizationMembers.organizationId, id)));
        if (!m)
            return c.json({ error: 'forbidden' }, 403);
    }
    let appearance = {};
    try {
        appearance = org.appearance ? JSON.parse(org.appearance) : {};
    }
    catch {
        appearance = {};
    }
    return c.json({
        ...org,
        issabelPbxApi: redactIssabelPbxApiJson(org.issabelPbxApi ?? undefined),
        appearance,
        customDomainVerifiedAt: org.customDomainVerifiedAt,
    });
});
const orgQuotasPatch = z.object({
    orgKind: z.enum(['pabx', 'dialer']).optional(),
    extensionsLimit: z.coerce.number().int().positive().nullable().optional(),
    channelsLimit: z.coerce.number().int().nonnegative().nullable().optional(),
    diskQuotaGb: z.coerce.number().nonnegative().nullable().optional(),
    cdrMysql: z.string().nullable().optional(),
    issabelPbxApi: z.string().nullable().optional(),
    active: z.boolean().optional(),
});
app.patch('/organizations/:id/quotas', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    const id = Number(c.req.param('id'));
    const parsed = orgQuotasPatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, id));
    if (!org)
        return c.json({ error: 'not_found' }, 404);
    if (b.cdrMysql !== undefined && b.cdrMysql !== null && String(b.cdrMysql).trim()) {
        const cfg = parseCdrConfig(String(b.cdrMysql));
        if (!cfg)
            return c.json({ error: 'invalid_cdr_mysql_json' }, 400);
    }
    const cdrNormalized = b.cdrMysql === undefined ? undefined : b.cdrMysql === null || b.cdrMysql === '' ? null : String(b.cdrMysql).trim() || null;
    let issabelPbxApiNext;
    if (b.issabelPbxApi !== undefined) {
        if (b.issabelPbxApi === null || b.issabelPbxApi.trim() === '') {
            issabelPbxApiNext = null;
        }
        else {
            try {
                issabelPbxApiNext = mergeIssabelPbxApiPatch(org.issabelPbxApi ?? null, String(b.issabelPbxApi).trim());
            }
            catch {
                return c.json({ error: 'invalid_issabel_pbx_api_json' }, 400);
            }
        }
    }
    await db
        .update(schema.organizations)
        .set({
        ...(b.orgKind !== undefined ? { orgKind: b.orgKind } : {}),
        ...(b.extensionsLimit !== undefined ? { extensionsLimit: b.extensionsLimit } : {}),
        ...(b.channelsLimit !== undefined ? { channelsLimit: b.channelsLimit } : {}),
        ...(b.diskQuotaGb !== undefined ? { diskQuotaGb: b.diskQuotaGb } : {}),
        ...(b.cdrMysql !== undefined ? { cdrMysql: cdrNormalized ?? null } : {}),
        ...(issabelPbxApiNext !== undefined ? { issabelPbxApi: issabelPbxApiNext } : {}),
        ...(b.active !== undefined ? { active: b.active } : {}),
    })
        .where(eq(schema.organizations.id, id));
    const [next] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, id));
    return c.json({
        ...next,
        issabelPbxApi: redactIssabelPbxApiJson(next?.issabelPbxApi ?? undefined),
    });
});
const appearancePatch = z.object({ appearance: z.record(z.unknown()) });
app.patch('/organizations/:id/appearance', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    if (u.role !== 'platform_admin' && u.role !== 'org_admin')
        return c.json({ error: 'forbidden' }, 403);
    if (u.role === 'org_admin') {
        const [m] = await db
            .select()
            .from(schema.organizationMembers)
            .where(and(eq(schema.organizationMembers.userId, u.id), eq(schema.organizationMembers.organizationId, id)));
        if (!m || m.role !== 'org_admin')
            return c.json({ error: 'forbidden' }, 403);
    }
    const parsed = appearancePatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const { appearance } = parsed.data;
    await db
        .update(schema.organizations)
        .set({ appearance: JSON.stringify(appearance) })
        .where(eq(schema.organizations.id, id));
    return c.json({ ok: true });
});
const domainPatch = z.object({
    customDomain: z.string().nullable(),
});
app.patch('/organizations/:id/custom-domain', async (c) => {
    const u = await getSessionUser(c);
    if (!u || (u.role !== 'platform_admin' && u.role !== 'org_admin'))
        return c.json({ error: 'forbidden' }, 403);
    const id = Number(c.req.param('id'));
    const parsed = domainPatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const { customDomain } = parsed.data;
    const token = randomUUID();
    await db
        .update(schema.organizations)
        .set({
        customDomain: customDomain ?? null,
        domainVerificationToken: customDomain ? token : null,
        customDomainVerifiedAt: null,
    })
        .where(eq(schema.organizations.id, id));
    return c.json({ ok: true, domainVerificationToken: customDomain ? token : null });
});
app.post('/organizations/:id/custom-domain/verify', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, id));
    if (!org?.domainVerificationToken)
        return c.json({ error: 'no_token' }, 400);
    // Dev: mark verified without real DNS
    await db
        .update(schema.organizations)
        .set({ customDomainVerifiedAt: new Date().toISOString() })
        .where(eq(schema.organizations.id, id));
    return c.json({ ok: true, verified: true });
});
app.get('/organizations/:id/spaces', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    if (!(await canReadOrg(u, id)))
        return c.json({ error: 'forbidden' }, 403);
    const q = listQuery.safeParse(c.req.query());
    if (!q.success)
        return c.json({ error: q.error.flatten() }, 400);
    const { page, pageSize, q: search } = q.data;
    const offset = (page - 1) * pageSize;
    const cond = [eq(schema.spaces.organizationId, id)];
    const where = search
        ? and(...cond, like(schema.spaces.name, `%${search}%`))
        : and(...cond);
    const items = await db
        .select()
        .from(schema.spaces)
        .where(where)
        .orderBy(asc(schema.spaces.name))
        .limit(pageSize)
        .offset(offset);
    const [{ count }] = await db.select({ count: sql `count(*)` }).from(schema.spaces).where(where);
    return c.json({ items, total: count, page, pageSize });
});
const spaceCreate = z.object({
    name: z.string().min(1).max(128),
    status: z.enum(['active', 'inactive']).optional(),
});
app.post('/organizations/:orgId/spaces', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    if (!(await canAdminOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const parsed = spaceCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    const [res] = await db
        .insert(schema.spaces)
        .values({ organizationId: orgId, name: b.name, status: b.status ?? 'active' });
    const [row] = await db.select().from(schema.spaces).where(eq(schema.spaces.id, res.insertId));
    return c.json(row);
});
const spacePatch = z.object({
    name: z.string().min(1).max(128).optional(),
    status: z.enum(['active', 'inactive']).optional(),
});
app.patch('/organizations/:orgId/spaces/:spaceId', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    const spaceId = Number(c.req.param('spaceId'));
    if (!(await canAdminOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const parsed = spacePatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [sp] = await db.select().from(schema.spaces).where(eq(schema.spaces.id, spaceId));
    if (!sp || sp.organizationId !== orgId)
        return c.json({ error: 'not_found' }, 404);
    const b = parsed.data;
    await db
        .update(schema.spaces)
        .set({
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.status !== undefined ? { status: b.status } : {}),
    })
        .where(eq(schema.spaces.id, spaceId));
    const [next] = await db.select().from(schema.spaces).where(eq(schema.spaces.id, spaceId));
    return c.json(next);
});
app.delete('/organizations/:orgId/spaces/:spaceId', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    const spaceId = Number(c.req.param('spaceId'));
    if (!(await canAdminOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const [sp] = await db.select().from(schema.spaces).where(eq(schema.spaces.id, spaceId));
    if (!sp || sp.organizationId !== orgId)
        return c.json({ error: 'not_found' }, 404);
    await db.delete(schema.spaces).where(eq(schema.spaces.id, spaceId));
    return c.json({ ok: true });
});
app.get('/metrics/billing-summary', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    const orgs = await db.select().from(schema.organizations).where(eq(schema.organizations.active, true));
    const spaces = await db.select({ count: sql `count(*)` }).from(schema.spaces);
    const [{ count: spaceCount }] = spaces;
    const priceRow = await db.select().from(schema.platformSettings).where(eq(schema.platformSettings.key, 'billing'));
    let price = 39;
    try {
        const v = priceRow[0]?.value ? JSON.parse(priceRow[0].value) : {};
        if (typeof v.pricePerClientUsd === 'number')
            price = v.pricePerClientUsd;
    }
    catch {
        /* ignore */
    }
    const activeClients = orgs.length;
    return c.json({
        activeOrganizations: activeClients,
        totalSpaces: spaceCount,
        pricePerClientUsd: price,
        mrrUsd: activeClients * price,
    });
});
app.get('/metrics/telephony-overview', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    let orgId = Number(c.req.query('organizationId') ?? '0') || 0;
    if (u.role !== 'platform_admin') {
        const allowed = u.role === 'org_admin' || u.role === 'org_operator' || u.role === 'org_viewer'
            ? (await db
                .select({ organizationId: schema.organizationMembers.organizationId })
                .from(schema.organizationMembers)
                .where(eq(schema.organizationMembers.userId, u.id))).map((r) => r.organizationId)
            : [];
        if (orgId && !allowed.includes(orgId))
            return c.json({ error: 'forbidden' }, 403);
        orgId = orgId || allowed[0] || 0;
        const [org] = orgId ? await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)) : [undefined];
        const overview = await resolveTelephonyOverview(org, orgId);
        return c.json(overview);
    }
    if (orgId <= 0) {
        const [first] = await db
            .select()
            .from(schema.organizations)
            .where(eq(schema.organizations.active, true))
            .orderBy(asc(schema.organizations.id))
            .limit(1);
        orgId = first?.id ?? 0;
        const overview = await resolveTelephonyOverview(first, orgId);
        return c.json(overview);
    }
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
    const overview = await resolveTelephonyOverview(org, orgId);
    return c.json(overview);
});
app.get('/metrics/platform-overview', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    return c.json(await buildPlatformOverview());
});
app.get('/metrics/calls-online', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const filterOrgId = Number(c.req.query('organizationId') ?? '0') || 0;
    let orgs = await db.select().from(schema.organizations).where(eq(schema.organizations.active, true)).orderBy(asc(schema.organizations.name));
    if (u.role !== 'platform_admin') {
        const mids = await db
            .select({ oid: schema.organizationMembers.organizationId })
            .from(schema.organizationMembers)
            .where(eq(schema.organizationMembers.userId, u.id));
        const allowed = new Set(mids.map((m) => m.oid));
        orgs = orgs.filter((o) => allowed.has(o.id));
        if (filterOrgId && !allowed.has(filterOrgId))
            return c.json({ error: 'forbidden' }, 403);
    }
    if (filterOrgId)
        orgs = orgs.filter((o) => o.id === filterOrgId);
    orgs = orgs.slice(0, 80);
    const items = await Promise.all(orgs.map(async (o) => {
        const t = await resolveTelephonyOverview(o, o.id);
        return {
            organizationId: o.id,
            name: o.name,
            onlineCalls: t.onlineCallsEstimate ?? 0,
            channelsMax: o.channelsLimit ?? 0,
        };
    }));
    return c.json({ items });
});
const cdrExportQuery = z.object({
    organizationId: z.coerce.number().optional(),
    from: z.string().min(1),
    to: z.string().min(1),
    src: z.string().optional(),
    dst: z.string().optional(),
});
const cdrHistoryQuery = cdrExportQuery.extend({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(200).default(50),
});
app.get('/metrics/cdr/history', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = cdrHistoryQuery.safeParse(c.req.query());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const { organizationId: oidOpt, from, to, src, dst, page, pageSize } = parsed.data;
    const oid = oidOpt ?? 0;
    if (oid && !(await canReadOrg(u, oid)))
        return c.json({ error: 'forbidden' }, 403);
    const [org] = oid ? await db.select().from(schema.organizations).where(eq(schema.organizations.id, oid)) : [undefined];
    const cfg = org?.cdrMysql?.trim() ? parseCdrConfig(org.cdrMysql) : globalCdrConfigFromEnv();
    if (!cfg)
        return c.json({ error: 'cdr_not_configured', items: [], total: 0, page, pageSize });
    let accountcode = null;
    if (org?.cdrMysql?.trim()) {
        try {
            const j = JSON.parse(org.cdrMysql);
            accountcode = typeof j.accountcode === 'string' ? j.accountcode : null;
        }
        catch {
            accountcode = null;
        }
    }
    try {
        const hist = await fetchCdrHistory(cfg, {
            accountcode,
            fromIso: from,
            toIso: to,
            src,
            dst,
            page,
            pageSize,
        });
        return c.json({ ...hist, page, pageSize, organizationId: oid || null });
    }
    catch (e) {
        console.error('[cdr/history]', e);
        return c.json({ error: 'cdr_query_failed' }, 502);
    }
});
app.get('/reports/cdr-export.csv', async (c) => {
    const u = await getSessionUser(c);
    if (!u || (u.role !== 'platform_admin' && u.role !== 'org_admin'))
        return c.json({ error: 'forbidden' }, 403);
    const parsed = cdrExportQuery.safeParse(c.req.query());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const { organizationId: oidOpt, from, to, src, dst } = parsed.data;
    const oid = oidOpt ?? 0;
    if (oid && !(await canReadOrg(u, oid)))
        return c.json({ error: 'forbidden' }, 403);
    const [org] = oid ? await db.select().from(schema.organizations).where(eq(schema.organizations.id, oid)) : [undefined];
    const cfg = org?.cdrMysql?.trim() ? parseCdrConfig(org.cdrMysql) : globalCdrConfigFromEnv();
    if (!cfg)
        return c.text('cdr_not_configured', 400);
    let accountcode = null;
    if (org?.cdrMysql?.trim()) {
        try {
            const j = JSON.parse(org.cdrMysql);
            accountcode = typeof j.accountcode === 'string' ? j.accountcode : null;
        }
        catch {
            accountcode = null;
        }
    }
    try {
        const { items } = await fetchCdrHistory(cfg, {
            accountcode,
            fromIso: from,
            toIso: to,
            src,
            dst,
            page: 1,
            pageSize: 50_000,
        });
        const header = 'calldate,src,dst,duration,billsec,disposition,uniqueid,dcontext,accountcode\n';
        const body = items
            .map((r) => [r.calldate, r.src, r.dst, r.duration, r.billsec, r.disposition, r.uniqueid, r.dcontext ?? '', r.accountcode ?? '']
            .map((x) => `"${String(x).replace(/"/g, '""')}"`)
            .join(','))
            .join('\n');
        c.header('Content-Type', 'text/csv; charset=utf-8');
        c.header('Content-Disposition', 'attachment; filename="cdr-export.csv"');
        return c.body(header + body);
    }
    catch (e) {
        console.error('[cdr-export]', e);
        return c.text('cdr_query_failed', 502);
    }
});
app.get('/users', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    if (u.role !== 'platform_admin' && u.role !== 'org_admin')
        return c.json({ error: 'forbidden' }, 403);
    if (u.role === 'platform_admin') {
        const rows = await db
            .select({
            id: schema.users.id,
            email: schema.users.email,
            displayName: schema.users.displayName,
            role: schema.users.role,
        })
            .from(schema.users);
        return c.json({ items: rows.map((r) => ({ ...r, orgRole: null })) });
    }
    const memberships = await db
        .select()
        .from(schema.organizationMembers)
        .where(eq(schema.organizationMembers.userId, u.id));
    const orgIds = memberships.map((m) => m.organizationId);
    if (orgIds.length === 0)
        return c.json({ items: [] });
    const memberRows = await db
        .select()
        .from(schema.organizationMembers)
        .where(inArray(schema.organizationMembers.organizationId, orgIds));
    const userIds = [...new Set(memberRows.map((m) => m.userId))];
    const rows = await db
        .select({
        id: schema.users.id,
        email: schema.users.email,
        displayName: schema.users.displayName,
        role: schema.users.role,
    })
        .from(schema.users)
        .where(inArray(schema.users.id, userIds));
    const items = rows.map((row) => {
        const m = memberRows.find((x) => x.userId === row.id);
        return { ...row, orgRole: m?.role ?? null };
    });
    return c.json({ items });
});
async function canResetUserPassword(u, targetUserId) {
    if (u.role === 'platform_admin')
        return true;
    if (u.role !== 'org_admin')
        return false;
    const mine = await db
        .select()
        .from(schema.organizationMembers)
        .where(eq(schema.organizationMembers.userId, u.id));
    const adminOrgIds = mine.filter((m) => m.role === 'org_admin').map((m) => m.organizationId);
    if (adminOrgIds.length === 0)
        return false;
    const theirs = await db
        .select()
        .from(schema.organizationMembers)
        .where(eq(schema.organizationMembers.userId, targetUserId));
    return theirs.some((m) => adminOrgIds.includes(m.organizationId));
}
const resetPasswordBody = z.object({ password: z.string().min(8).max(128) });
app.post('/users/:id/reset-password', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = resetPasswordBody.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    if (!(await canResetUserPassword(u, id)))
        return c.json({ error: 'forbidden' }, 403);
    const [target] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    if (!target)
        return c.json({ error: 'not_found' }, 404);
    const hash = bcrypt.hashSync(parsed.data.password, 10);
    await db.update(schema.users).set({ passwordHash: hash }).where(eq(schema.users.id, id));
    return c.json({ ok: true });
});
app.get('/users/export.csv', async (c) => {
    const u = await getSessionUser(c);
    if (!u || (u.role !== 'platform_admin' && u.role !== 'org_admin'))
        return c.json({ error: 'forbidden' }, 403);
    let rows = [];
    if (u.role === 'platform_admin') {
        const r = await db
            .select({ id: schema.users.id, email: schema.users.email, displayName: schema.users.displayName, role: schema.users.role })
            .from(schema.users);
        rows = r.map((x) => ({ ...x, orgRole: null }));
    }
    else {
        const memberships = await db
            .select()
            .from(schema.organizationMembers)
            .where(eq(schema.organizationMembers.userId, u.id));
        const orgIds = memberships.map((m) => m.organizationId);
        if (orgIds.length === 0)
            rows = [];
        else {
            const memberRows = await db
                .select()
                .from(schema.organizationMembers)
                .where(inArray(schema.organizationMembers.organizationId, orgIds));
            const userIds = [...new Set(memberRows.map((m) => m.userId))];
            const r = await db
                .select({ id: schema.users.id, email: schema.users.email, displayName: schema.users.displayName, role: schema.users.role })
                .from(schema.users)
                .where(inArray(schema.users.id, userIds));
            rows = r.map((row) => {
                const m = memberRows.find((x) => x.userId === row.id);
                return { ...row, orgRole: m?.role ?? null };
            });
        }
    }
    const header = 'id,email,displayName,role,orgRole\n';
    const body = rows
        .map((r) => [r.id, r.email, r.displayName, r.role, r.orgRole ?? ''].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="users-export.csv"');
    return c.body(header + body);
});
const blocklistBody = z.object({
    ip: z.string().min(1),
    port: z.coerce.number().int().optional().nullable(),
    protocol: z.enum(['udp', 'tcp', 'both']).optional(),
    blockedUntil: z.string().nullable().optional(),
});
app.get('/security/blocklist', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    const items = await db.select().from(schema.securityBlocklist).orderBy(desc(schema.securityBlocklist.id)).limit(500);
    return c.json({ items });
});
app.post('/security/blocklist', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    const parsed = blocklistBody.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    const now = new Date().toISOString();
    const [res] = await db
        .insert(schema.securityBlocklist)
        .values({
        ip: b.ip,
        port: b.port ?? null,
        protocol: b.protocol ?? 'udp',
        blockedFrom: now,
        blockedUntil: b.blockedUntil ?? null,
        blockType: 'manual',
    });
    const [row] = await db.select().from(schema.securityBlocklist).where(eq(schema.securityBlocklist.id, res.insertId));
    await db.insert(schema.securityBlockLog).values({
        ip: b.ip,
        port: b.port ?? 5060,
        protocol: b.protocol ?? 'udp',
        at: now,
        blockType: 'manual',
        action: 'manual_block',
    });
    return c.json(row);
});
app.delete('/security/blocklist/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.securityBlocklist).where(eq(schema.securityBlocklist.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    await db.delete(schema.securityBlocklist).where(eq(schema.securityBlocklist.id, id));
    await db.insert(schema.securityBlockLog).values({
        ip: row.ip,
        port: row.port ?? 5060,
        protocol: row.protocol,
        at: new Date().toISOString(),
        blockType: 'manual',
        action: 'unblocked',
    });
    return c.json({ ok: true });
});
app.get('/security/trustlist', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    const items = await db.select().from(schema.securityTrustlist).orderBy(desc(schema.securityTrustlist.id)).limit(500);
    return c.json({ items });
});
const trustlistBody = z.object({
    ip: z.string().min(1),
    port: z.coerce.number().int().optional().nullable(),
    protocol: z.enum(['udp', 'tcp', 'both']).optional(),
});
app.post('/security/trustlist', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    const parsed = trustlistBody.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    const now = new Date().toISOString();
    const [res] = await db
        .insert(schema.securityTrustlist)
        .values({
        ip: b.ip,
        port: b.port ?? null,
        protocol: b.protocol ?? 'udp',
        releasedAt: now,
    });
    const [row] = await db.select().from(schema.securityTrustlist).where(eq(schema.securityTrustlist.id, res.insertId));
    await db.insert(schema.securityBlockLog).values({
        ip: b.ip,
        port: b.port ?? 5060,
        protocol: b.protocol ?? 'udp',
        at: now,
        blockType: 'manual',
        action: 'trustlist_add',
    });
    return c.json(row);
});
app.delete('/security/trustlist/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.securityTrustlist).where(eq(schema.securityTrustlist.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    await db.delete(schema.securityTrustlist).where(eq(schema.securityTrustlist.id, id));
    await db.insert(schema.securityBlockLog).values({
        ip: row.ip,
        port: row.port ?? 5060,
        protocol: row.protocol,
        at: new Date().toISOString(),
        blockType: 'manual',
        action: 'trustlist_remove',
    });
    return c.json({ ok: true });
});
app.get('/security/auto-config', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    let [row] = await db.select().from(schema.securityAutoConfig).where(eq(schema.securityAutoConfig.id, 1));
    if (!row) {
        await db
            .insert(schema.securityAutoConfig)
            .ignore()
            .values({
            id: 1,
            enabled: true,
            blockWhat: 'ip',
            analysisPeriodSec: 2000,
            failuresPerExtension: 5,
            failuresPerIp: 50,
            block1Minutes: 60,
            block2Minutes: 1440,
            block3Minutes: 10080,
        });
        [row] = await db.select().from(schema.securityAutoConfig).where(eq(schema.securityAutoConfig.id, 1));
    }
    return c.json(row ?? null);
});
const autoConfigPatch = z.object({
    enabled: z.boolean().optional(),
    blockWhat: z.enum(['ip', 'port']).optional(),
    analysisPeriodSec: z.coerce.number().int().positive().optional(),
    failuresPerExtension: z.coerce.number().int().positive().optional(),
    failuresPerIp: z.coerce.number().int().positive().optional(),
    block1Minutes: z.coerce.number().int().positive().optional(),
    block2Minutes: z.coerce.number().int().positive().optional(),
    block3Minutes: z.coerce.number().int().positive().optional(),
});
app.patch('/security/auto-config', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    const parsed = autoConfigPatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    await db
        .update(schema.securityAutoConfig)
        .set({
        ...(b.enabled !== undefined ? { enabled: b.enabled } : {}),
        ...(b.blockWhat !== undefined ? { blockWhat: b.blockWhat } : {}),
        ...(b.analysisPeriodSec !== undefined ? { analysisPeriodSec: b.analysisPeriodSec } : {}),
        ...(b.failuresPerExtension !== undefined ? { failuresPerExtension: b.failuresPerExtension } : {}),
        ...(b.failuresPerIp !== undefined ? { failuresPerIp: b.failuresPerIp } : {}),
        ...(b.block1Minutes !== undefined ? { block1Minutes: b.block1Minutes } : {}),
        ...(b.block2Minutes !== undefined ? { block2Minutes: b.block2Minutes } : {}),
        ...(b.block3Minutes !== undefined ? { block3Minutes: b.block3Minutes } : {}),
    })
        .where(eq(schema.securityAutoConfig.id, 1));
    const [next] = await db.select().from(schema.securityAutoConfig).where(eq(schema.securityAutoConfig.id, 1));
    return c.json(next);
});
app.get('/security/logs', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    const ip = c.req.query('ip')?.trim();
    const blockType = c.req.query('blockType')?.trim();
    const conds = [];
    if (ip)
        conds.push(like(schema.securityBlockLog.ip, `%${ip}%`));
    if (blockType === 'manual' || blockType === 'auto')
        conds.push(eq(schema.securityBlockLog.blockType, blockType));
    const where = conds.length ? and(...conds) : undefined;
    const items = where
        ? await db
            .select()
            .from(schema.securityBlockLog)
            .where(where)
            .orderBy(desc(schema.securityBlockLog.id))
            .limit(500)
        : await db.select().from(schema.securityBlockLog).orderBy(desc(schema.securityBlockLog.id)).limit(500);
    return c.json({ items });
});
app.get('/diagnostics/summary', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    const [{ c: orgCount }] = await db.select({ c: sql `count(*)` }).from(schema.organizations);
    const [{ c: userCount }] = await db.select({ c: sql `count(*)` }).from(schema.users);
    const [{ c: spaceCount }] = await db.select({ c: sql `count(*)` }).from(schema.spaces);
    const [{ c: whCount }] = await db.select({ c: sql `count(*)` }).from(schema.webhookEndpoints);
    const [{ c: ruleCount }] = await db.select({ c: sql `count(*)` }).from(schema.callReactionRules);
    return c.json({
        apiVersion: '0.1.0',
        uptimeHint: 'dev',
        counts: { organizations: orgCount, users: userCount, spaces: spaceCount, webhooks: whCount, callRules: ruleCount },
    });
});
app.get('/extensions', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const items = await db.select().from(schema.extensions).where(eq(schema.extensions.organizationId, orgId));
    return c.json({ items });
});
app.get('/extensions/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.extensions).where(eq(schema.extensions.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canReadOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const meta = safeParseJsonObject(row.metadata);
    return c.json({
        id: row.id,
        organizationId: row.organizationId,
        spaceId: row.spaceId,
        number: row.number,
        displayName: row.displayName,
        source: row.source,
        createdAt: row.createdAt,
        ...meta,
    });
});
app.post('/extensions', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const raw = await c.req.json();
    const parsed = parseExtensionCreateBody(raw);
    if (!parsed.ok)
        return c.json({ error: parsed.err.flatten() }, 400);
    const b = parsed;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const [dup] = await db
        .select({ id: schema.extensions.id })
        .from(schema.extensions)
        .where(and(eq(schema.extensions.organizationId, b.organizationId), eq(schema.extensions.number, b.number)));
    if (dup)
        return c.json({ error: 'duplicate_number' }, 409);
    const [orgCheck] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, b.organizationId));
    if (!orgCheck)
        return c.json({ error: 'not_found' }, 404);
    if (orgCheck.extensionsLimit != null) {
        const [{ c: extCount }] = await db.select({ c: sql `count(*)` }).from(schema.extensions).where(eq(schema.extensions.organizationId, b.organizationId));
        if (Number(extCount) >= orgCheck.extensionsLimit) {
            return c.json({ error: 'extensions_limit_reached', limit: orgCheck.extensionsLimit }, 422);
        }
    }
    const [res] = await db
        .insert(schema.extensions)
        .values({
        organizationId: b.organizationId,
        spaceId: b.spaceId ?? null,
        number: b.number,
        displayName: b.displayName,
        metadata: b.metadataStr,
        source: 'portal',
    });
    let [row] = await db.select().from(schema.extensions).where(eq(schema.extensions.id, res.insertId));
    row = await syncPortalExtensionToIssabel(orgCheck, row, 'create');
    return c.json(row);
});
app.patch('/extensions/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const raw = await c.req.json();
    const [row] = await db.select().from(schema.extensions).where(eq(schema.extensions.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const parsed = parseExtensionPatchBody(raw, row.metadata);
    if (!parsed.ok)
        return c.json({ error: parsed.err.flatten() }, 400);
    const { core: p } = parsed;
    if (p.number && p.number !== row.number) {
        const [dup] = await db
            .select({ id: schema.extensions.id })
            .from(schema.extensions)
            .where(and(eq(schema.extensions.organizationId, row.organizationId), eq(schema.extensions.number, p.number)));
        if (dup)
            return c.json({ error: 'duplicate_number' }, 409);
    }
    await db
        .update(schema.extensions)
        .set({
        ...(p.number !== undefined ? { number: p.number } : {}),
        ...(p.displayName !== undefined ? { displayName: p.displayName } : {}),
        ...(p.spaceId !== undefined ? { spaceId: p.spaceId } : {}),
        metadata: parsed.metadataStr,
    })
        .where(eq(schema.extensions.id, id));
    let [next] = await db.select().from(schema.extensions).where(eq(schema.extensions.id, id));
    const [orgRow] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, row.organizationId));
    if (orgRow)
        next = await syncPortalExtensionToIssabel(orgRow, next, 'update');
    return c.json(next);
});
app.delete('/extensions/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.extensions).where(eq(schema.extensions.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.extensions).where(eq(schema.extensions.id, id));
    return c.json({ ok: true });
});
app.get('/webhooks/endpoints', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const rows = await db.select().from(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.organizationId, orgId));
    return c.json({
        items: rows.map((r) => ({
            ...r,
            eventTypes: JSON.parse(r.eventTypes || '[]'),
        })),
    });
});
const whCreate = z.object({
    organizationId: z.number(),
    url: z.string().url(),
    secret: z.string().min(8),
    eventTypes: z.array(z.string()),
    enabled: z.boolean().optional(),
});
app.post('/webhooks/endpoints', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = whCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const [res] = await db
        .insert(schema.webhookEndpoints)
        .values({
        organizationId: b.organizationId,
        url: b.url,
        secret: b.secret,
        eventTypes: JSON.stringify(b.eventTypes),
        enabled: b.enabled ?? true,
    });
    const [row] = await db.select().from(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.id, res.insertId));
    return c.json(row);
});
const whPatch = z.object({
    url: z.string().url().optional(),
    secret: z.string().min(8).optional(),
    eventTypes: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
});
app.patch('/webhooks/endpoints/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = whPatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const b = parsed.data;
    await db
        .update(schema.webhookEndpoints)
        .set({
        ...(b.url !== undefined ? { url: b.url } : {}),
        ...(b.secret !== undefined ? { secret: b.secret } : {}),
        ...(b.eventTypes !== undefined ? { eventTypes: JSON.stringify(b.eventTypes) } : {}),
        ...(b.enabled !== undefined ? { enabled: b.enabled } : {}),
    })
        .where(eq(schema.webhookEndpoints.id, id));
    const [next] = await db.select().from(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.id, id));
    return c.json({
        ...next,
        eventTypes: JSON.parse(next.eventTypes || '[]'),
    });
});
app.delete('/webhooks/endpoints/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.id, id));
    return c.json({ ok: true });
});
const telephonySchema = z.object({
    organizationId: z.number(),
    eventType: z.string(),
    featureKey: z.string().optional(),
    payload: z.record(z.unknown()),
});
app.post('/internal/telephony/events', async (c) => {
    const secret = c.req.header('x-internal-token');
    if (process.env.NODE_ENV === 'production' && secret !== process.env.INTERNAL_TELEPHONY_TOKEN) {
        return c.json({ error: 'forbidden' }, 403);
    }
    const parsed = telephonySchema.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const body = parsed.data;
    const rules = await db
        .select()
        .from(schema.callReactionRules)
        .where(and(eq(schema.callReactionRules.organizationId, body.organizationId), eq(schema.callReactionRules.eventType, body.eventType), eq(schema.callReactionRules.enabled, true)));
    const results = [];
    for (const rule of rules) {
        if (rule.featureKey && rule.featureKey !== body.featureKey)
            continue;
        if (rule.actionKind === 'http_request' && rule.urlTemplate && rule.httpMethod) {
            let url = rule.urlTemplate;
            for (const [k, v] of Object.entries(body.payload)) {
                url = url.replaceAll(`{{event.${k}}}`, String(v));
            }
            let hostname = '';
            try {
                hostname = new URL(url).hostname;
            }
            catch {
                results.push({ ruleId: rule.id, error: 'bad_url' });
                continue;
            }
            if (isBlockedHost(hostname)) {
                results.push({ ruleId: rule.id, error: 'blocked_host' });
                continue;
            }
            try {
                const res = await fetch(url, {
                    method: rule.httpMethod,
                    headers: rule.headersTemplate ? JSON.parse(rule.headersTemplate) : { 'Content-Type': 'application/json' },
                    body: rule.httpMethod === 'GET' || rule.httpMethod === 'HEAD' ? undefined : rule.bodyTemplate ?? '{}',
                });
                await db.insert(schema.callReactionDeliveryLog).values({
                    ruleId: rule.id,
                    status: res.ok ? 'success' : 'failed',
                    httpStatus: res.status,
                    summary: await res.text().then((t) => t.slice(0, 500)),
                });
                results.push({ ruleId: rule.id, httpStatus: res.status });
            }
            catch (e) {
                await db.insert(schema.callReactionDeliveryLog).values({
                    ruleId: rule.id,
                    status: 'failed',
                    summary: String(e).slice(0, 500),
                });
                results.push({ ruleId: rule.id, error: String(e) });
            }
        }
    }
    return c.json({ ok: true, results });
});
app.get('/integrations', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const rows = await db.select().from(schema.integrations).where(eq(schema.integrations.organizationId, orgId));
    return c.json({
        items: rows.map((r) => ({ ...r, config: JSON.parse(r.config || '{}') })),
    });
});
const integrationCreate = z.object({
    organizationId: z.number(),
    type: z.string().min(1).max(64),
    status: z.enum(['active', 'inactive', 'error', 'pending']).optional(),
    config: z.record(z.unknown()),
});
app.post('/integrations', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = integrationCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const [res] = await db
        .insert(schema.integrations)
        .values({
        organizationId: b.organizationId,
        type: b.type,
        status: b.status ?? 'active',
        config: JSON.stringify(b.config),
        enabled: (b.status ?? 'active') === 'active',
    });
    const [row] = await db.select().from(schema.integrations).where(eq(schema.integrations.id, res.insertId));
    return c.json({ ...row, config: JSON.parse(row.config || '{}') }, 201);
});
const integrationPatch = z.object({
    type: z.string().min(1).max(64).optional(),
    status: z.enum(['active', 'inactive', 'error', 'pending']).optional(),
    config: z.record(z.unknown()).optional(),
});
app.patch('/integrations/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = integrationPatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.integrations).where(eq(schema.integrations.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const b = parsed.data;
    await db
        .update(schema.integrations)
        .set({
        ...(b.type !== undefined ? { type: b.type } : {}),
        ...(b.status !== undefined ? { status: b.status, enabled: b.status === 'active' } : {}),
        ...(b.config !== undefined ? { config: JSON.stringify(b.config) } : {}),
    })
        .where(eq(schema.integrations.id, id));
    const [next] = await db.select().from(schema.integrations).where(eq(schema.integrations.id, id));
    return c.json({ ...next, config: JSON.parse(next.config || '{}') });
});
app.delete('/integrations/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.integrations).where(eq(schema.integrations.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.integrations).where(eq(schema.integrations.id, id));
    return c.json({ ok: true });
});
// ─── Extension Groups ────────────────────────────────────────────────────────
app.get('/extension-groups', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const rows = await db.select().from(schema.extensionGroups).where(eq(schema.extensionGroups.organizationId, orgId)).orderBy(asc(schema.extensionGroups.name));
    return c.json({ items: rows.map((r) => ({ ...r, extensionIds: JSON.parse(r.extensionIds || '[]') })) });
});
const extGroupCreate = z.object({
    organizationId: z.number(),
    name: z.string().min(1).max(128),
    description: z.string().max(512).optional(),
    extensionIds: z.array(z.number()).optional(),
});
app.post('/extension-groups', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = extGroupCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const [res] = await db.insert(schema.extensionGroups).values({
        organizationId: b.organizationId,
        name: b.name,
        description: b.description ?? null,
        extensionIds: JSON.stringify(b.extensionIds ?? []),
    });
    const [row] = await db.select().from(schema.extensionGroups).where(eq(schema.extensionGroups.id, res.insertId));
    return c.json({ ...row, extensionIds: JSON.parse(row.extensionIds) }, 201);
});
const extGroupPatch = z.object({
    name: z.string().min(1).max(128).optional(),
    description: z.string().max(512).nullable().optional(),
    extensionIds: z.array(z.number()).optional(),
});
app.patch('/extension-groups/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = extGroupPatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.extensionGroups).where(eq(schema.extensionGroups.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const b = parsed.data;
    await db.update(schema.extensionGroups).set({
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
        ...(b.extensionIds !== undefined ? { extensionIds: JSON.stringify(b.extensionIds) } : {}),
    }).where(eq(schema.extensionGroups.id, id));
    const [next] = await db.select().from(schema.extensionGroups).where(eq(schema.extensionGroups.id, id));
    return c.json({ ...next, extensionIds: JSON.parse(next.extensionIds) });
});
app.delete('/extension-groups/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.extensionGroups).where(eq(schema.extensionGroups.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.extensionGroups).where(eq(schema.extensionGroups.id, id));
    return c.json({ ok: true });
});
// ─── Teams ───────────────────────────────────────────────────────────────────
app.get('/teams', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const rows = await db.select().from(schema.teams).where(eq(schema.teams.organizationId, orgId)).orderBy(asc(schema.teams.name));
    return c.json({ items: rows.map((r) => ({ ...r, extensionIds: JSON.parse(r.extensionIds || '[]') })) });
});
const teamCreate = z.object({
    organizationId: z.number(),
    name: z.string().min(1).max(128),
    description: z.string().max(512).optional(),
    extensionIds: z.array(z.number()).optional(),
});
app.post('/teams', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = teamCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const [res] = await db.insert(schema.teams).values({
        organizationId: b.organizationId,
        name: b.name,
        description: b.description ?? null,
        extensionIds: JSON.stringify(b.extensionIds ?? []),
    });
    const [row] = await db.select().from(schema.teams).where(eq(schema.teams.id, res.insertId));
    return c.json({ ...row, extensionIds: JSON.parse(row.extensionIds) }, 201);
});
const teamPatch = z.object({
    name: z.string().min(1).max(128).optional(),
    description: z.string().max(512).nullable().optional(),
    extensionIds: z.array(z.number()).optional(),
});
app.patch('/teams/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = teamPatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.teams).where(eq(schema.teams.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const b = parsed.data;
    await db.update(schema.teams).set({
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
        ...(b.extensionIds !== undefined ? { extensionIds: JSON.stringify(b.extensionIds) } : {}),
    }).where(eq(schema.teams.id, id));
    const [next] = await db.select().from(schema.teams).where(eq(schema.teams.id, id));
    return c.json({ ...next, extensionIds: JSON.parse(next.extensionIds) });
});
app.delete('/teams/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.teams).where(eq(schema.teams.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.teams).where(eq(schema.teams.id, id));
    return c.json({ ok: true });
});
// ─── WhatsApp status ─────────────────────────────────────────────────────────
app.get('/whatsapp/status', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const [whatsappIntegration] = await db
        .select()
        .from(schema.integrations)
        .where(and(eq(schema.integrations.organizationId, orgId), eq(schema.integrations.type, 'whatsapp')));
    const isConfigured = !!whatsappIntegration && whatsappIntegration.status === 'active';
    const [{ c: extCount }] = await db
        .select({ c: sql `count(*)` })
        .from(schema.extensions)
        .where(eq(schema.extensions.organizationId, orgId));
    return c.json({
        isConfigured,
        messageCount: 0,
        extensionCount: Number(extCount),
        integration: whatsappIntegration ?? null,
    });
});
// ─── AI Agents ───────────────────────────────────────────────────────────────
app.get('/ai-agents', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const items = await db
        .select()
        .from(schema.aiAgents)
        .where(eq(schema.aiAgents.organizationId, orgId))
        .orderBy(asc(schema.aiAgents.id));
    return c.json({ items });
});
const aiAgentCreate = z.object({
    organizationId: z.number(),
    name: z.string().min(1).max(128),
    model: z.string().min(1).max(64),
    prompt: z.string().max(10000),
});
app.post('/ai-agents', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = aiAgentCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const [res] = await db
        .insert(schema.aiAgents)
        .values({ organizationId: b.organizationId, name: b.name, model: b.model, prompt: b.prompt });
    const [row] = await db.select().from(schema.aiAgents).where(eq(schema.aiAgents.id, res.insertId));
    return c.json(row, 201);
});
const aiAgentPatch = z.object({
    name: z.string().min(1).max(128).optional(),
    model: z.string().min(1).max(64).optional(),
    prompt: z.string().max(10000).optional(),
    enabled: z.boolean().optional(),
});
app.patch('/ai-agents/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = aiAgentPatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.aiAgents).where(eq(schema.aiAgents.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const b = parsed.data;
    await db
        .update(schema.aiAgents)
        .set({
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.model !== undefined ? { model: b.model } : {}),
        ...(b.prompt !== undefined ? { prompt: b.prompt } : {}),
        ...(b.enabled !== undefined ? { enabled: b.enabled } : {}),
    })
        .where(eq(schema.aiAgents.id, id));
    const [next] = await db.select().from(schema.aiAgents).where(eq(schema.aiAgents.id, id));
    return c.json(next);
});
app.delete('/ai-agents/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.aiAgents).where(eq(schema.aiAgents.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.aiAgents).where(eq(schema.aiAgents.id, id));
    return c.json({ ok: true });
});
app.get('/call-flows', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const rows = await db.select().from(schema.callFlows).where(eq(schema.callFlows.organizationId, orgId));
    return c.json({
        items: rows.map((r) => ({ ...r, graph: JSON.parse(r.graphJson || '{}') })),
    });
});
const flowCreate = z.object({
    organizationId: z.number(),
    name: z.string().min(1).max(128),
    graph: z.unknown().optional(),
});
app.post('/call-flows', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = flowCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const graph = (b.graph ?? { nodes: [], edges: [] });
    const [res] = await db
        .insert(schema.callFlows)
        .values({
        organizationId: b.organizationId,
        name: b.name,
        graphJson: JSON.stringify(graph),
        version: 1,
    });
    const [row] = await db.select().from(schema.callFlows).where(eq(schema.callFlows.id, res.insertId));
    return c.json({ ...row, graph: JSON.parse(row.graphJson || '{}') });
});
const flowPatch = z.object({
    name: z.string().min(1).max(128).optional(),
    graph: z.unknown().optional(),
});
app.patch('/call-flows/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = flowPatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.callFlows).where(eq(schema.callFlows.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const b = parsed.data;
    const nextGraph = b.graph !== undefined ? JSON.stringify(b.graph) : undefined;
    await db
        .update(schema.callFlows)
        .set({
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(nextGraph !== undefined ? { graphJson: nextGraph, version: row.version + 1 } : {}),
        updatedAt: new Date().toISOString(),
    })
        .where(eq(schema.callFlows.id, id));
    const [next] = await db.select().from(schema.callFlows).where(eq(schema.callFlows.id, id));
    return c.json({ ...next, graph: JSON.parse(next.graphJson || '{}') });
});
app.delete('/call-flows/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.callFlows).where(eq(schema.callFlows.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.callFlows).where(eq(schema.callFlows.id, id));
    return c.json({ ok: true });
});
app.get('/call-reaction-rules', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const rows = await db.select().from(schema.callReactionRules).where(eq(schema.callReactionRules.organizationId, orgId));
    return c.json({ items: rows });
});
const ruleCreate = z.object({
    organizationId: z.number(),
    eventType: z.string(),
    featureKey: z.string().optional().nullable(),
    priority: z.number().optional(),
    actionKind: z.enum(['http_request', 'whatsapp_meta']),
    httpMethod: z.string().optional(),
    urlTemplate: z.string().optional(),
    headersTemplate: z.record(z.string()).optional(),
    bodyTemplate: z.string().optional(),
    templateNameOrId: z.string().optional(),
});
app.post('/call-reaction-rules', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = ruleCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const [res] = await db
        .insert(schema.callReactionRules)
        .values({
        organizationId: b.organizationId,
        eventType: b.eventType,
        featureKey: b.featureKey ?? null,
        priority: b.priority ?? 100,
        enabled: true,
        actionKind: b.actionKind,
        httpMethod: b.httpMethod ?? null,
        urlTemplate: b.urlTemplate ?? null,
        headersTemplate: b.headersTemplate ? JSON.stringify(b.headersTemplate) : null,
        bodyTemplate: b.bodyTemplate ?? null,
        templateNameOrId: b.templateNameOrId ?? null,
    });
    const [row] = await db.select().from(schema.callReactionRules).where(eq(schema.callReactionRules.id, res.insertId));
    return c.json(row);
});
const rulePatch = z.object({
    enabled: z.boolean().optional(),
    priority: z.number().optional(),
    eventType: z.string().min(1).optional(),
    featureKey: z.string().nullable().optional(),
    actionKind: z.enum(['http_request', 'whatsapp_meta']).optional(),
    httpMethod: z.string().nullable().optional(),
    urlTemplate: z.string().nullable().optional(),
    headersTemplate: z.unknown().optional(),
    bodyTemplate: z.string().nullable().optional(),
    templateNameOrId: z.string().nullable().optional(),
});
app.patch('/call-reaction-rules/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = rulePatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.callReactionRules).where(eq(schema.callReactionRules.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const b = parsed.data;
    await db
        .update(schema.callReactionRules)
        .set({
        ...(b.enabled !== undefined ? { enabled: b.enabled } : {}),
        ...(b.priority !== undefined ? { priority: b.priority } : {}),
        ...(b.eventType !== undefined ? { eventType: b.eventType } : {}),
        ...(b.featureKey !== undefined ? { featureKey: b.featureKey } : {}),
        ...(b.actionKind !== undefined ? { actionKind: b.actionKind } : {}),
        ...(b.httpMethod !== undefined ? { httpMethod: b.httpMethod } : {}),
        ...(b.urlTemplate !== undefined ? { urlTemplate: b.urlTemplate } : {}),
        ...(b.headersTemplate !== undefined
            ? {
                headersTemplate: b.headersTemplate === null || b.headersTemplate === undefined
                    ? null
                    : JSON.stringify(b.headersTemplate),
            }
            : {}),
        ...(b.bodyTemplate !== undefined ? { bodyTemplate: b.bodyTemplate } : {}),
        ...(b.templateNameOrId !== undefined ? { templateNameOrId: b.templateNameOrId } : {}),
    })
        .where(eq(schema.callReactionRules.id, id));
    const [next] = await db.select().from(schema.callReactionRules).where(eq(schema.callReactionRules.id, id));
    return c.json(next);
});
app.delete('/call-reaction-rules/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.callReactionRules).where(eq(schema.callReactionRules.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.callReactionRules).where(eq(schema.callReactionRules.id, id));
    return c.json({ ok: true });
});
// ─── Organizations CRUD ───────────────────────────────────────────────────────
const orgCreate = z.object({
    name: z.string().min(1).max(128),
    tradeName: z.string().max(128).nullable().optional(),
    orgKind: z.enum(['pabx', 'dialer']).optional(),
    issabelBaseUrl: z.string().nullable().optional(),
    extensionsLimit: z.coerce.number().int().positive().nullable().optional(),
    channelsLimit: z.coerce.number().int().nonnegative().nullable().optional(),
    diskQuotaGb: z.coerce.number().nonnegative().nullable().optional(),
    cdrMysql: z.string().nullable().optional(),
    issabelPbxApi: z.string().nullable().optional(),
});
app.post('/organizations', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    const parsed = orgCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    let issabelPbxApiInsert = null;
    if (b.issabelPbxApi?.trim()) {
        try {
            issabelPbxApiInsert = mergeIssabelPbxApiPatch(null, b.issabelPbxApi.trim());
        }
        catch {
            return c.json({ error: 'invalid_issabel_pbx_api_json' }, 400);
        }
    }
    const [res] = await db
        .insert(schema.organizations)
        .values({
        name: b.name,
        tradeName: b.tradeName ?? null,
        orgKind: b.orgKind ?? 'pabx',
        issabelBaseUrl: b.issabelBaseUrl ?? null,
        extensionsLimit: b.extensionsLimit ?? null,
        channelsLimit: b.channelsLimit ?? null,
        diskQuotaGb: b.diskQuotaGb ?? null,
        cdrMysql: b.cdrMysql ?? null,
        issabelPbxApi: issabelPbxApiInsert,
        active: true,
    });
    const [row] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, res.insertId));
    return c.json({
        ...row,
        issabelPbxApi: redactIssabelPbxApiJson(row?.issabelPbxApi ?? undefined),
    }, 201);
});
const orgPatch = z.object({
    name: z.string().min(1).max(128).optional(),
    tradeName: z.string().max(128).nullable().optional(),
    issabelBaseUrl: z.string().nullable().optional(),
    issabelPbxApi: z.string().nullable().optional(),
    active: z.boolean().optional(),
});
app.patch('/organizations/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    const id = Number(c.req.param('id'));
    const parsed = orgPatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, id));
    if (!org)
        return c.json({ error: 'not_found' }, 404);
    const b = parsed.data;
    let issabelPbxApiMerged;
    if (b.issabelPbxApi !== undefined) {
        if (b.issabelPbxApi === null || b.issabelPbxApi.trim() === '') {
            issabelPbxApiMerged = null;
        }
        else {
            try {
                issabelPbxApiMerged = mergeIssabelPbxApiPatch(org.issabelPbxApi ?? null, b.issabelPbxApi.trim());
            }
            catch {
                return c.json({ error: 'invalid_issabel_pbx_api_json' }, 400);
            }
        }
    }
    await db
        .update(schema.organizations)
        .set({
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.tradeName !== undefined ? { tradeName: b.tradeName } : {}),
        ...(b.issabelBaseUrl !== undefined ? { issabelBaseUrl: b.issabelBaseUrl } : {}),
        ...(issabelPbxApiMerged !== undefined ? { issabelPbxApi: issabelPbxApiMerged } : {}),
        ...(b.active !== undefined ? { active: b.active } : {}),
    })
        .where(eq(schema.organizations.id, id));
    const [next] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, id));
    return c.json({
        ...next,
        issabelPbxApi: redactIssabelPbxApiJson(next?.issabelPbxApi ?? undefined),
    });
});
app.delete('/organizations/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    const id = Number(c.req.param('id'));
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, id));
    if (!org)
        return c.json({ error: 'not_found' }, 404);
    await db.delete(schema.organizations).where(eq(schema.organizations.id, id));
    return c.json({ ok: true });
});
// ─── Organization Members ─────────────────────────────────────────────────────
app.get('/organizations/:orgId/members', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const rows = await db
        .select({
        userId: schema.organizationMembers.userId,
        role: schema.organizationMembers.role,
        email: schema.users.email,
        displayName: schema.users.displayName,
    })
        .from(schema.organizationMembers)
        .innerJoin(schema.users, eq(schema.users.id, schema.organizationMembers.userId))
        .where(eq(schema.organizationMembers.organizationId, orgId));
    return c.json({ items: rows });
});
const memberCreate = z.object({
    userId: z.number().int().positive(),
    role: z.enum(['org_admin', 'org_operator', 'org_viewer']),
});
app.post('/organizations/:orgId/members', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    const orgId = Number(c.req.param('orgId'));
    const parsed = memberCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
    if (!org)
        return c.json({ error: 'not_found' }, 404);
    const [usr] = await db.select().from(schema.users).where(eq(schema.users.id, b.userId));
    if (!usr)
        return c.json({ error: 'user_not_found' }, 404);
    await db
        .insert(schema.organizationMembers)
        .values({ organizationId: orgId, userId: b.userId, role: b.role })
        .onDuplicateKeyUpdate({ set: { role: b.role } });
    return c.json({ ok: true });
});
app.delete('/organizations/:orgId/members/:userId', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    const orgId = Number(c.req.param('orgId'));
    const userId = Number(c.req.param('userId'));
    await db
        .delete(schema.organizationMembers)
        .where(and(eq(schema.organizationMembers.organizationId, orgId), eq(schema.organizationMembers.userId, userId)));
    return c.json({ ok: true });
});
// ─── Users CRUD ──────────────────────────────────────────────────────────────
const userCreate = z.object({
    email: z.string().email(),
    displayName: z.string().min(1).max(128),
    password: z.string().min(8).max(128),
    role: z.enum(['platform_admin', 'org_admin', 'org_operator', 'org_viewer']),
});
app.post('/users', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    const parsed = userCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, b.email));
    if (existing)
        return c.json({ error: 'email_taken' }, 409);
    const hash = bcrypt.hashSync(b.password, 10);
    const [res] = await db
        .insert(schema.users)
        .values({ email: b.email, displayName: b.displayName, passwordHash: hash, role: b.role });
    const [row] = await db
        .select({ id: schema.users.id, email: schema.users.email, displayName: schema.users.displayName, role: schema.users.role })
        .from(schema.users)
        .where(eq(schema.users.id, res.insertId));
    return c.json(row, 201);
});
app.delete('/users/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u || u.role !== 'platform_admin')
        return c.json({ error: 'forbidden' }, 403);
    const id = Number(c.req.param('id'));
    if (id === u.id)
        return c.json({ error: 'cannot_delete_self' }, 400);
    const [target] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    if (!target)
        return c.json({ error: 'not_found' }, 404);
    await db.delete(schema.users).where(eq(schema.users.id, id));
    return c.json({ ok: true });
});
// ─── Extensions limit enforcement ────────────────────────────────────────────
// (already done inline above in POST /extensions — extensionsLimit checked below)
// ─── Campaigns ───────────────────────────────────────────────────────────────
app.get('/campaigns', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const items = await db.select().from(schema.campaigns).where(eq(schema.campaigns.organizationId, orgId)).orderBy(desc(schema.campaigns.id));
    return c.json({ items });
});
const campaignCreate = z.object({
    organizationId: z.number(),
    name: z.string().min(1).max(128),
    type: z.enum(['outbound', 'preview', 'predictive']).optional(),
    status: z.enum(['active', 'paused', 'completed', 'draft']).optional(),
    description: z.string().max(512).optional(),
});
app.post('/campaigns', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = campaignCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const [res] = await db.insert(schema.campaigns).values({
        organizationId: b.organizationId, name: b.name,
        type: b.type ?? 'outbound', status: b.status ?? 'draft',
        description: b.description ?? null,
    });
    const [row] = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, res.insertId));
    return c.json(row, 201);
});
const campaignPatch = z.object({
    name: z.string().min(1).max(128).optional(),
    type: z.enum(['outbound', 'preview', 'predictive']).optional(),
    status: z.enum(['active', 'paused', 'completed', 'draft']).optional(),
    description: z.string().max(512).nullable().optional(),
});
app.patch('/campaigns/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = campaignPatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const b = parsed.data;
    await db.update(schema.campaigns).set({
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.type !== undefined ? { type: b.type } : {}),
        ...(b.status !== undefined ? { status: b.status } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
    }).where(eq(schema.campaigns.id, id));
    const [next] = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, id));
    return c.json(next);
});
app.delete('/campaigns/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.campaigns).where(eq(schema.campaigns.id, id));
    return c.json({ ok: true });
});
// ─── Holidays ─────────────────────────────────────────────────────────────────
app.get('/holidays', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const items = await db.select().from(schema.holidays).where(eq(schema.holidays.organizationId, orgId)).orderBy(asc(schema.holidays.date));
    return c.json({ items });
});
const holidayCreate = z.object({
    organizationId: z.number(),
    name: z.string().min(1).max(128),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    recurs: z.boolean().optional(),
    description: z.string().max(256).optional(),
});
app.post('/holidays', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = holidayCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const [res] = await db.insert(schema.holidays).values({
        organizationId: b.organizationId, name: b.name, date: b.date,
        recurs: b.recurs ?? false, description: b.description ?? null,
    });
    const [row] = await db.select().from(schema.holidays).where(eq(schema.holidays.id, res.insertId));
    return c.json(row, 201);
});
app.delete('/holidays/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.holidays).where(eq(schema.holidays.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.holidays).where(eq(schema.holidays.id, id));
    return c.json({ ok: true });
});
// ─── Pause Types ──────────────────────────────────────────────────────────────
app.get('/pause-types', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const items = await db.select().from(schema.pauseTypes).where(eq(schema.pauseTypes.organizationId, orgId)).orderBy(asc(schema.pauseTypes.name));
    return c.json({ items });
});
const pauseTypeCreate = z.object({
    organizationId: z.number(),
    name: z.string().min(1).max(64),
    code: z.string().min(1).max(16),
    description: z.string().max(256).optional(),
});
app.post('/pause-types', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = pauseTypeCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const [res] = await db.insert(schema.pauseTypes).values({
        organizationId: b.organizationId, name: b.name, code: b.code,
        description: b.description ?? null, enabled: true,
    });
    const [row] = await db.select().from(schema.pauseTypes).where(eq(schema.pauseTypes.id, res.insertId));
    return c.json(row, 201);
});
const pauseTypePatch = z.object({
    name: z.string().min(1).max(64).optional(),
    code: z.string().min(1).max(16).optional(),
    description: z.string().max(256).nullable().optional(),
    enabled: z.boolean().optional(),
});
app.patch('/pause-types/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = pauseTypePatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.pauseTypes).where(eq(schema.pauseTypes.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const b = parsed.data;
    await db.update(schema.pauseTypes).set({
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.code !== undefined ? { code: b.code } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
        ...(b.enabled !== undefined ? { enabled: b.enabled } : {}),
    }).where(eq(schema.pauseTypes.id, id));
    const [next] = await db.select().from(schema.pauseTypes).where(eq(schema.pauseTypes.id, id));
    return c.json(next);
});
app.delete('/pause-types/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.pauseTypes).where(eq(schema.pauseTypes.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.pauseTypes).where(eq(schema.pauseTypes.id, id));
    return c.json({ ok: true });
});
// ─── Cost Centers ─────────────────────────────────────────────────────────────
app.get('/cost-centers', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const items = await db.select().from(schema.costCenters).where(eq(schema.costCenters.organizationId, orgId)).orderBy(asc(schema.costCenters.code));
    return c.json({ items });
});
const costCenterCreate = z.object({
    organizationId: z.number(),
    code: z.string().min(1).max(32),
    name: z.string().min(1).max(128),
    description: z.string().max(256).optional(),
});
app.post('/cost-centers', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = costCenterCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const [res] = await db.insert(schema.costCenters).values({
        organizationId: b.organizationId, code: b.code, name: b.name,
        description: b.description ?? null,
    });
    const [row] = await db.select().from(schema.costCenters).where(eq(schema.costCenters.id, res.insertId));
    return c.json(row, 201);
});
const costCenterPatch = z.object({
    code: z.string().min(1).max(32).optional(),
    name: z.string().min(1).max(128).optional(),
    description: z.string().max(256).nullable().optional(),
});
app.patch('/cost-centers/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = costCenterPatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.costCenters).where(eq(schema.costCenters.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const b = parsed.data;
    await db.update(schema.costCenters).set({
        ...(b.code !== undefined ? { code: b.code } : {}),
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
    }).where(eq(schema.costCenters.id, id));
    const [next] = await db.select().from(schema.costCenters).where(eq(schema.costCenters.id, id));
    return c.json(next);
});
app.delete('/cost-centers/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.costCenters).where(eq(schema.costCenters.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.costCenters).where(eq(schema.costCenters.id, id));
    return c.json({ ok: true });
});
// ─── Queues ───────────────────────────────────────────────────────────────────
app.get('/queues', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const items = await db.select().from(schema.queues).where(eq(schema.queues.organizationId, orgId)).orderBy(desc(schema.queues.id));
    return c.json({ items });
});
const queueCreate = z.object({
    organizationId: z.number(),
    name: z.string().min(1).max(128),
    strategy: z.enum(['roundrobin', 'leastrecent', 'fewestcalls', 'random', 'rrmemory']).optional(),
    timeout: z.number().int().min(5).max(300).optional(),
    maxCalls: z.number().int().optional(),
    musicOnHold: z.string().max(128).optional(),
    description: z.string().max(512).optional(),
});
app.post('/queues', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = queueCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const [res] = await db.insert(schema.queues).values({
        organizationId: b.organizationId,
        name: b.name,
        strategy: b.strategy ?? 'roundrobin',
        timeout: b.timeout ?? 30,
        maxCalls: b.maxCalls ?? null,
        musicOnHold: b.musicOnHold ?? null,
        description: b.description ?? null,
    });
    const [row] = await db.select().from(schema.queues).where(eq(schema.queues.id, res.insertId));
    return c.json(row, 201);
});
const queuePatch = z.object({
    name: z.string().min(1).max(128).optional(),
    strategy: z.enum(['roundrobin', 'leastrecent', 'fewestcalls', 'random', 'rrmemory']).optional(),
    timeout: z.number().int().optional(),
    maxCalls: z.number().int().nullable().optional(),
    musicOnHold: z.string().max(128).nullable().optional(),
    description: z.string().max(512).nullable().optional(),
});
app.patch('/queues/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = queuePatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.queues).where(eq(schema.queues.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const b = parsed.data;
    await db.update(schema.queues).set({
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.strategy !== undefined ? { strategy: b.strategy } : {}),
        ...(b.timeout !== undefined ? { timeout: b.timeout } : {}),
        ...(b.maxCalls !== undefined ? { maxCalls: b.maxCalls } : {}),
        ...(b.musicOnHold !== undefined ? { musicOnHold: b.musicOnHold } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
    }).where(eq(schema.queues.id, id));
    const [next] = await db.select().from(schema.queues).where(eq(schema.queues.id, id));
    return c.json(next);
});
app.delete('/queues/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.queues).where(eq(schema.queues.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.queues).where(eq(schema.queues.id, id));
    return c.json({ ok: true });
});
// ─── Conference Rooms ─────────────────────────────────────────────────────────
app.get('/conference-rooms', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const items = await db.select().from(schema.conferenceRooms).where(eq(schema.conferenceRooms.organizationId, orgId)).orderBy(desc(schema.conferenceRooms.id));
    return c.json({ items });
});
const conferenceRoomCreate = z.object({
    organizationId: z.number(),
    roomNumber: z.string().min(1).max(20),
    name: z.string().min(1).max(128),
    pin: z.string().max(20).optional(),
    maxParticipants: z.number().int().optional(),
    description: z.string().max(512).optional(),
});
app.post('/conference-rooms', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = conferenceRoomCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const [res] = await db.insert(schema.conferenceRooms).values({
        organizationId: b.organizationId,
        roomNumber: b.roomNumber,
        name: b.name,
        pin: b.pin ?? null,
        maxParticipants: b.maxParticipants ?? null,
        description: b.description ?? null,
    });
    const [row] = await db.select().from(schema.conferenceRooms).where(eq(schema.conferenceRooms.id, res.insertId));
    return c.json(row, 201);
});
const conferenceRoomPatch = z.object({
    roomNumber: z.string().min(1).max(20).optional(),
    name: z.string().min(1).max(128).optional(),
    pin: z.string().max(20).nullable().optional(),
    maxParticipants: z.number().int().nullable().optional(),
    description: z.string().max(512).nullable().optional(),
});
app.patch('/conference-rooms/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = conferenceRoomPatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.conferenceRooms).where(eq(schema.conferenceRooms.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const b = parsed.data;
    await db.update(schema.conferenceRooms).set({
        ...(b.roomNumber !== undefined ? { roomNumber: b.roomNumber } : {}),
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.pin !== undefined ? { pin: b.pin } : {}),
        ...(b.maxParticipants !== undefined ? { maxParticipants: b.maxParticipants } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
    }).where(eq(schema.conferenceRooms.id, id));
    const [next] = await db.select().from(schema.conferenceRooms).where(eq(schema.conferenceRooms.id, id));
    return c.json(next);
});
app.delete('/conference-rooms/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.conferenceRooms).where(eq(schema.conferenceRooms.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.conferenceRooms).where(eq(schema.conferenceRooms.id, id));
    return c.json({ ok: true });
});
// ─── Hold Groups ──────────────────────────────────────────────────────────────
app.get('/hold-groups', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const items = await db.select().from(schema.holdGroups).where(eq(schema.holdGroups.organizationId, orgId)).orderBy(desc(schema.holdGroups.id));
    return c.json({ items });
});
const holdGroupCreate = z.object({
    organizationId: z.number(),
    name: z.string().min(1).max(128),
    description: z.string().max(512).optional(),
    mode: z.enum(['files', 'playlist', 'random', 'none']).optional(),
});
app.post('/hold-groups', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = holdGroupCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const [res] = await db.insert(schema.holdGroups).values({
        organizationId: b.organizationId,
        name: b.name,
        description: b.description ?? null,
        mode: b.mode ?? 'files',
    });
    const [row] = await db.select().from(schema.holdGroups).where(eq(schema.holdGroups.id, res.insertId));
    return c.json(row, 201);
});
const holdGroupPatch = z.object({
    name: z.string().min(1).max(128).optional(),
    description: z.string().max(512).nullable().optional(),
    mode: z.enum(['files', 'playlist', 'random', 'none']).optional(),
});
app.patch('/hold-groups/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = holdGroupPatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.holdGroups).where(eq(schema.holdGroups.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const b = parsed.data;
    await db.update(schema.holdGroups).set({
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
        ...(b.mode !== undefined ? { mode: b.mode } : {}),
    }).where(eq(schema.holdGroups.id, id));
    const [next] = await db.select().from(schema.holdGroups).where(eq(schema.holdGroups.id, id));
    return c.json(next);
});
app.delete('/hold-groups/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.holdGroups).where(eq(schema.holdGroups.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.holdGroups).where(eq(schema.holdGroups.id, id));
    return c.json({ ok: true });
});
// ─── Trunks ───────────────────────────────────────────────────────────────────
app.get('/trunks', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const items = await db.select().from(schema.trunks).where(eq(schema.trunks.organizationId, orgId)).orderBy(desc(schema.trunks.id));
    return c.json({ items });
});
const trunkCreate = z.object({
    organizationId: z.number(),
    name: z.string().min(1).max(128),
    type: z.enum(['sip', 'iax2', 'dahdi']).optional(),
    host: z.string().max(256).optional(),
    username: z.string().max(128).optional(),
    status: z.enum(['active', 'inactive']).optional(),
    description: z.string().max(512).optional(),
});
app.post('/trunks', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = trunkCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const [res] = await db.insert(schema.trunks).values({
        organizationId: b.organizationId,
        name: b.name,
        type: b.type ?? 'sip',
        host: b.host ?? null,
        username: b.username ?? null,
        status: b.status ?? 'active',
        description: b.description ?? null,
    });
    const [row] = await db.select().from(schema.trunks).where(eq(schema.trunks.id, res.insertId));
    return c.json(row, 201);
});
const trunkPatch = z.object({
    name: z.string().min(1).max(128).optional(),
    type: z.enum(['sip', 'iax2', 'dahdi']).optional(),
    host: z.string().max(256).nullable().optional(),
    username: z.string().max(128).nullable().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    description: z.string().max(512).nullable().optional(),
});
app.patch('/trunks/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = trunkPatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.trunks).where(eq(schema.trunks.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const b = parsed.data;
    await db.update(schema.trunks).set({
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.type !== undefined ? { type: b.type } : {}),
        ...(b.host !== undefined ? { host: b.host } : {}),
        ...(b.username !== undefined ? { username: b.username } : {}),
        ...(b.status !== undefined ? { status: b.status } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
    }).where(eq(schema.trunks.id, id));
    const [next] = await db.select().from(schema.trunks).where(eq(schema.trunks.id, id));
    return c.json(next);
});
app.delete('/trunks/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.trunks).where(eq(schema.trunks.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.trunks).where(eq(schema.trunks.id, id));
    return c.json({ ok: true });
});
// ─── Outbound Routes ──────────────────────────────────────────────────────────
app.get('/outbound-routes', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const items = await db.select().from(schema.outboundRoutes).where(eq(schema.outboundRoutes.organizationId, orgId)).orderBy(desc(schema.outboundRoutes.id));
    return c.json({ items });
});
const outboundRouteCreate = z.object({
    organizationId: z.number(),
    name: z.string().min(1).max(128),
    pattern: z.string().min(1).max(64),
    trunkId: z.number().int().nullable().optional(),
    prefix: z.string().max(32).optional(),
    priority: z.number().int().min(0).optional(),
    description: z.string().max(512).optional(),
});
app.post('/outbound-routes', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = outboundRouteCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const [res] = await db.insert(schema.outboundRoutes).values({
        organizationId: b.organizationId,
        name: b.name,
        pattern: b.pattern,
        trunkId: b.trunkId ?? null,
        prefix: b.prefix ?? null,
        priority: b.priority ?? 0,
        description: b.description ?? null,
    });
    const [row] = await db.select().from(schema.outboundRoutes).where(eq(schema.outboundRoutes.id, res.insertId));
    return c.json(row, 201);
});
const outboundRoutePatch = z.object({
    name: z.string().min(1).max(128).optional(),
    pattern: z.string().min(1).max(64).optional(),
    trunkId: z.number().int().nullable().optional(),
    prefix: z.string().max(32).nullable().optional(),
    priority: z.number().int().min(0).optional(),
    description: z.string().max(512).nullable().optional(),
});
app.patch('/outbound-routes/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = outboundRoutePatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.outboundRoutes).where(eq(schema.outboundRoutes.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const b = parsed.data;
    await db.update(schema.outboundRoutes).set({
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.pattern !== undefined ? { pattern: b.pattern } : {}),
        ...(b.trunkId !== undefined ? { trunkId: b.trunkId } : {}),
        ...(b.prefix !== undefined ? { prefix: b.prefix } : {}),
        ...(b.priority !== undefined ? { priority: b.priority } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
    }).where(eq(schema.outboundRoutes.id, id));
    const [next] = await db.select().from(schema.outboundRoutes).where(eq(schema.outboundRoutes.id, id));
    return c.json(next);
});
app.delete('/outbound-routes/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.outboundRoutes).where(eq(schema.outboundRoutes.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.outboundRoutes).where(eq(schema.outboundRoutes.id, id));
    return c.json({ ok: true });
});
// ─── Campaign Schedules ───────────────────────────────────────────────────────
app.get('/campaign-schedules', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const rows = await db.select().from(schema.campaignSchedules).where(eq(schema.campaignSchedules.organizationId, orgId)).orderBy(desc(schema.campaignSchedules.id));
    const items = rows.map((i) => ({ ...i, daysOfWeek: JSON.parse(i.daysOfWeek ?? '[1,2,3,4,5]') }));
    return c.json({ items });
});
const campaignScheduleCreate = z.object({
    organizationId: z.number(),
    name: z.string().min(1).max(128),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    description: z.string().max(512).optional(),
});
app.post('/campaign-schedules', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = campaignScheduleCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const [res] = await db.insert(schema.campaignSchedules).values({
        organizationId: b.organizationId,
        name: b.name,
        daysOfWeek: b.daysOfWeek !== undefined ? JSON.stringify(b.daysOfWeek) : '[1,2,3,4,5]',
        startTime: b.startTime ?? '08:00',
        endTime: b.endTime ?? '18:00',
        description: b.description ?? null,
    });
    const [row] = await db.select().from(schema.campaignSchedules).where(eq(schema.campaignSchedules.id, res.insertId));
    return c.json({ ...row, daysOfWeek: JSON.parse(row.daysOfWeek ?? '[1,2,3,4,5]') }, 201);
});
const campaignSchedulePatch = z.object({
    name: z.string().min(1).max(128).optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    description: z.string().max(512).nullable().optional(),
});
app.patch('/campaign-schedules/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = campaignSchedulePatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.campaignSchedules).where(eq(schema.campaignSchedules.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const b = parsed.data;
    await db.update(schema.campaignSchedules).set({
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.daysOfWeek !== undefined ? { daysOfWeek: JSON.stringify(b.daysOfWeek) } : {}),
        ...(b.startTime !== undefined ? { startTime: b.startTime } : {}),
        ...(b.endTime !== undefined ? { endTime: b.endTime } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
    }).where(eq(schema.campaignSchedules.id, id));
    const [next] = await db.select().from(schema.campaignSchedules).where(eq(schema.campaignSchedules.id, id));
    return c.json({ ...next, daysOfWeek: JSON.parse(next.daysOfWeek ?? '[1,2,3,4,5]') });
});
app.delete('/campaign-schedules/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.campaignSchedules).where(eq(schema.campaignSchedules.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.campaignSchedules).where(eq(schema.campaignSchedules.id, id));
    return c.json({ ok: true });
});
// ─── Campaign Ratings ─────────────────────────────────────────────────────────
app.get('/campaign-ratings', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const items = await db.select().from(schema.campaignRatings).where(eq(schema.campaignRatings.organizationId, orgId)).orderBy(desc(schema.campaignRatings.id));
    return c.json({ items });
});
const campaignRatingCreate = z.object({
    organizationId: z.number(),
    name: z.string().min(1).max(128),
    code: z.string().min(1).max(20),
    maxAttempts: z.number().int().min(1).optional(),
    waitDays: z.number().int().min(0).optional(),
    description: z.string().max(512).optional(),
});
app.post('/campaign-ratings', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const parsed = campaignRatingCreate.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const [res] = await db.insert(schema.campaignRatings).values({
        organizationId: b.organizationId,
        name: b.name,
        code: b.code,
        maxAttempts: b.maxAttempts ?? 3,
        waitDays: b.waitDays ?? 1,
        description: b.description ?? null,
    });
    const [row] = await db.select().from(schema.campaignRatings).where(eq(schema.campaignRatings.id, res.insertId));
    return c.json(row, 201);
});
const campaignRatingPatch = z.object({
    name: z.string().min(1).max(128).optional(),
    code: z.string().min(1).max(20).optional(),
    maxAttempts: z.number().int().min(1).optional(),
    waitDays: z.number().int().min(0).optional(),
    description: z.string().max(512).nullable().optional(),
});
app.patch('/campaign-ratings/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = campaignRatingPatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.campaignRatings).where(eq(schema.campaignRatings.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const b = parsed.data;
    await db.update(schema.campaignRatings).set({
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.code !== undefined ? { code: b.code } : {}),
        ...(b.maxAttempts !== undefined ? { maxAttempts: b.maxAttempts } : {}),
        ...(b.waitDays !== undefined ? { waitDays: b.waitDays } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
    }).where(eq(schema.campaignRatings.id, id));
    const [next] = await db.select().from(schema.campaignRatings).where(eq(schema.campaignRatings.id, id));
    return c.json(next);
});
app.delete('/campaign-ratings/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.campaignRatings).where(eq(schema.campaignRatings.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.campaignRatings).where(eq(schema.campaignRatings.id, id));
    return c.json({ ok: true });
});
// ─── Audio Files ──────────────────────────────────────────────────────────────
app.get('/audio-files', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const items = await db.select().from(schema.audioFiles).where(eq(schema.audioFiles.organizationId, orgId)).orderBy(desc(schema.audioFiles.id));
    return c.json({ items });
});
const AUDIO_DIR = process.env.AUDIO_FILES_DIR ?? './audio-uploads';
const ALLOWED_AUDIO_TYPES = new Set(['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-wav', 'audio/mp3', 'audio/x-gsm', 'audio/basic']);
const MAX_AUDIO_SIZE = 20 * 1024 * 1024; // 20 MB
app.post('/audio-files', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const body = await c.req.parseBody();
    const orgId = Number(body.organizationId);
    const name = String(body.name ?? '').trim();
    const description = body.description ? String(body.description).trim() : null;
    const file = body.file;
    if (!orgId || !name)
        return c.json({ error: 'organizationId and name are required' }, 400);
    if (!(await canWriteOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    let storedFilename = null;
    if (file && file instanceof File) {
        if (file.size > MAX_AUDIO_SIZE)
            return c.json({ error: 'file_too_large', maxBytes: MAX_AUDIO_SIZE }, 413);
        if (!ALLOWED_AUDIO_TYPES.has(file.type))
            return c.json({ error: 'invalid_file_type' }, 415);
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
        storedFilename = `${randomUUID()}.${ext}`;
        await mkdir(AUDIO_DIR, { recursive: true });
        const buf = Buffer.from(await file.arrayBuffer());
        await writeFile(join(AUDIO_DIR, storedFilename), buf);
    }
    const [res] = await db.insert(schema.audioFiles).values({
        organizationId: orgId,
        name,
        filename: storedFilename,
        description,
    });
    const [row] = await db.select().from(schema.audioFiles).where(eq(schema.audioFiles.id, res.insertId));
    return c.json(row, 201);
});
app.get('/audio-files/:id/stream', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.audioFiles).where(eq(schema.audioFiles.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canReadOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    if (!row.filename)
        return c.json({ error: 'no_file' }, 404);
    const { createReadStream } = await import('node:fs');
    const filePath = join(AUDIO_DIR, row.filename);
    const stream = createReadStream(filePath);
    c.header('Content-Disposition', `attachment; filename="${row.filename}"`);
    c.header('Content-Type', 'audio/mpeg');
    return c.body(stream);
});
const audioFilePatch = z.object({
    name: z.string().min(1).max(128).optional(),
    filename: z.string().max(256).nullable().optional(),
    description: z.string().max(512).nullable().optional(),
});
app.patch('/audio-files/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const parsed = audioFilePatch.safeParse(await c.req.json());
    if (!parsed.success)
        return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.audioFiles).where(eq(schema.audioFiles.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    const b = parsed.data;
    await db.update(schema.audioFiles).set({
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.filename !== undefined ? { filename: b.filename } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
    }).where(eq(schema.audioFiles.id, id));
    const [next] = await db.select().from(schema.audioFiles).where(eq(schema.audioFiles.id, id));
    return c.json(next);
});
app.delete('/audio-files/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.audioFiles).where(eq(schema.audioFiles.id, id));
    if (!row)
        return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId)))
        return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.audioFiles).where(eq(schema.audioFiles.id, id));
    if (row.filename) {
        await unlink(join(AUDIO_DIR, row.filename)).catch(() => { });
    }
    return c.json({ ok: true });
});
// ─── Metrics: Queue Log ───────────────────────────────────────────────────────
app.get('/metrics/queue-log', async (c) => {
    const u = await getSessionUser(c);
    if (!u)
        return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId)
        return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId)))
        return c.json({ error: 'forbidden' }, 403);
    const from = c.req.query('from') ?? '';
    const to = c.req.query('to') ?? '';
    const pageSize = Math.min(Number(c.req.query('pageSize') ?? 100), 500);
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
    const cfg = org?.cdrMysql?.trim() ? parseCdrConfig(org.cdrMysql) : globalCdrConfigFromEnv();
    if (!cfg)
        return c.json({ error: 'cdr_not_configured', items: [] });
    try {
        const mysql = await import('mysql2/promise');
        const conn = await mysql.default.createConnection({
            host: cfg.host,
            port: cfg.port ?? 3306,
            user: cfg.user,
            password: cfg.password,
            database: cfg.database,
            connectTimeout: 8000,
        });
        try {
            const [rows] = await conn.query(`SELECT time, callid, queuename, agent, event, data1, data2, data3, data4, data5 FROM queue_log WHERE FROM_UNIXTIME(time) BETWEEN ? AND ? ORDER BY time DESC LIMIT ?`, [from, to, pageSize]);
            return c.json({ items: rows });
        }
        finally {
            await conn.end();
        }
    }
    catch (e) {
        console.error('[metrics/queue-log]', e);
        return c.json({ error: 'queue_log_query_failed', items: [] }, 502);
    }
});
app.get('/health', (c) => c.json({ ok: true }));
const port = Number(process.env.PORT ?? 8787);
console.log(`API on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
