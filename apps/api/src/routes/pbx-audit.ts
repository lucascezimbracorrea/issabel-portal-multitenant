import { desc, eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { db as DbType } from '../db/client.js';
import * as schema from '../db/schema.js';
import { resolveDestinationLabel } from '../lib/destination-resolver.js';
import type { RouteType } from '../lib/routing-types.js';
import { resolveQueueMetrics } from './issabel-phase2.js';

type Deps = {
  db: typeof DbType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSessionUser: (c: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  canReadOrg: (u: any, organizationId: number) => Promise<boolean>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  canWriteOrg: (u: any, organizationId: number) => Promise<boolean>;
};

function mockQueueMetrics(queueId: number) {
  const seed = queueId % 7;
  return {
    callsWaiting: seed,
    answeredToday: 42 + seed * 3,
    abandonedToday: 2 + (seed % 3),
    avgWaitSec: 28 + seed * 4,
    avgTalkSec: 185 + seed * 12,
    serviceLevelPct: 88 - seed,
    demo: true,
  };
}

export function registerPbxAuditRoutes(app: Hono, deps: Deps) {
  const { db, getSessionUser, canReadOrg, canWriteOrg } = deps;

  app.get('/call-flows/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.callFlows).where(eq(schema.callFlows.id, id));
    if (!row) return c.json({ error: 'not_found' }, 404);
    if (!(await canReadOrg(u, row.organizationId))) return c.json({ error: 'forbidden' }, 403);
    return c.json({ ...row, graph: JSON.parse(row.graphJson || '{}') });
  });

  app.get('/trunks/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.trunks).where(eq(schema.trunks.id, id));
    if (!row) return c.json({ error: 'not_found' }, 404);
    if (!(await canReadOrg(u, row.organizationId))) return c.json({ error: 'forbidden' }, 403);
    return c.json({
      ...row,
      tariffs: JSON.parse(row.tariffsJson || '[]'),
      codecs: JSON.parse(row.codecs || '[]'),
      password: row.password ? '********' : null,
    });
  });

  app.get('/queues/:id/dashboard', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.queues).where(eq(schema.queues.id, id));
    if (!row) return c.json({ error: 'not_found' }, 404);
    if (!(await canReadOrg(u, row.organizationId))) return c.json({ error: 'forbidden' }, 403);
    const members = await db.select().from(schema.queueMembers).where(eq(schema.queueMembers.queueId, id));
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, row.organizationId));
    const metrics = await resolveQueueMetrics(
      db,
      row,
      org?.issabelPbxApi ?? null,
      org?.cdrMysql ?? null,
      () => mockQueueMetrics(id),
    );
    return c.json({ queue: row, metrics, members });
  });

  app.get('/queues/:id/members', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.queues).where(eq(schema.queues.id, id));
    if (!row) return c.json({ error: 'not_found' }, 404);
    if (!(await canReadOrg(u, row.organizationId))) return c.json({ error: 'forbidden' }, 403);
    const items = await db.select().from(schema.queueMembers).where(eq(schema.queueMembers.queueId, id));
    return c.json({ items });
  });

  const memberCreate = z.object({
    extensionId: z.number().optional().nullable(),
    agentLabel: z.string().min(1).max(128),
  });

  app.post('/queues/:id/members', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const queueId = Number(c.req.param('id'));
    const parsed = memberCreate.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const [row] = await db.select().from(schema.queues).where(eq(schema.queues.id, queueId));
    if (!row) return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId))) return c.json({ error: 'forbidden' }, 403);
    const [res] = await db.insert(schema.queueMembers).values({
      queueId,
      extensionId: parsed.data.extensionId ?? null,
      agentLabel: parsed.data.agentLabel,
    }) as unknown as [{ insertId: number }];
    const [member] = await db.select().from(schema.queueMembers).where(eq(schema.queueMembers.id, res.insertId));
    return c.json(member, 201);
  });

  app.delete('/queues/:queueId/members/:memberId', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const memberId = Number(c.req.param('memberId'));
    const [member] = await db.select().from(schema.queueMembers).where(eq(schema.queueMembers.id, memberId));
    if (!member) return c.json({ error: 'not_found' }, 404);
    const [queue] = await db.select().from(schema.queues).where(eq(schema.queues.id, member.queueId));
    if (!queue || !(await canWriteOrg(u, queue.organizationId))) return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.queueMembers).where(eq(schema.queueMembers.id, memberId));
    return c.json({ ok: true });
  });

  app.get('/internal-numbers', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.query('organizationId'));
    if (!orgId) return c.json({ error: 'organizationId required' }, 400);
    if (!(await canReadOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);

    const explicit = await db
      .select()
      .from(schema.internalNumbers)
      .where(eq(schema.internalNumbers.organizationId, orgId))
      .orderBy(desc(schema.internalNumbers.id));

    const uras = await db.select().from(schema.uras).where(eq(schema.uras.organizationId, orgId));
    const queues = await db.select().from(schema.queues).where(eq(schema.queues.organizationId, orgId));
    const flows = await db.select().from(schema.callFlows).where(eq(schema.callFlows.organizationId, orgId));
    const extensions = await db.select().from(schema.extensions).where(eq(schema.extensions.organizationId, orgId));

    type MapRow = {
      id: string;
      shortNumber: string;
      destType: string;
      destinationId: number;
      name: string;
      source: 'explicit' | 'auto';
    };

    const items: MapRow[] = [];
    const seen = new Set<string>();

    for (const row of explicit) {
      const key = row.shortNumber;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: `explicit-${row.id}`,
        shortNumber: row.shortNumber,
        destType: row.destType,
        destinationId: row.destinationId,
        name: row.name,
        source: 'explicit',
      });
    }

    for (const ura of uras) {
      if (!ura.extensionNumber?.trim()) continue;
      const key = ura.extensionNumber.trim();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: `ura-${ura.id}`,
        shortNumber: key,
        destType: 'ura',
        destinationId: ura.id,
        name: ura.name,
        source: 'auto',
      });
    }

    for (const q of queues) {
      const num = (q.queueCode ?? '').trim() || String(6000 + q.id);
      if (seen.has(num)) continue;
      seen.add(num);
      items.push({
        id: `queue-${q.id}`,
        shortNumber: num,
        destType: 'queue',
        destinationId: q.id,
        name: q.name,
        source: 'auto',
      });
    }

    for (const flow of flows) {
      if (!flow.extensionNumber?.trim()) continue;
      const key = flow.extensionNumber.trim();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: `flow-${flow.id}`,
        shortNumber: key,
        destType: 'call_flow',
        destinationId: flow.id,
        name: flow.name,
        source: 'auto',
      });
    }

    for (const ext of extensions) {
      const key = ext.number.trim();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: `ext-${ext.id}`,
        shortNumber: key,
        destType: 'extension',
        destinationId: ext.id,
        name: ext.displayName,
        source: 'auto',
      });
    }

    items.sort((a, b) => a.shortNumber.localeCompare(b.shortNumber, undefined, { numeric: true }));
    return c.json({ items });
  });

  const internalCreate = z.object({
    organizationId: z.number(),
    shortNumber: z.string().min(1).max(32),
    destType: z.enum(['ura', 'queue', 'call_flow', 'extension']),
    destinationId: z.number(),
    name: z.string().min(1).max(255),
  });

  app.post('/internal-numbers', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const parsed = internalCreate.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    if (!(await canWriteOrg(u, b.organizationId))) return c.json({ error: 'forbidden' }, 403);
    const label = await resolveDestinationLabel(b.organizationId, b.destType as RouteType, b.destinationId);
    const [res] = await db.insert(schema.internalNumbers).values({
      organizationId: b.organizationId,
      shortNumber: b.shortNumber,
      destType: b.destType,
      destinationId: b.destinationId,
      name: b.name || label || b.shortNumber,
    }) as unknown as [{ insertId: number }];
    const [row] = await db.select().from(schema.internalNumbers).where(eq(schema.internalNumbers.id, res.insertId));
    return c.json(row, 201);
  });

  app.delete('/internal-numbers/:id', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.internalNumbers).where(eq(schema.internalNumbers.id, id));
    if (!row) return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId))) return c.json({ error: 'forbidden' }, 403);
    await db.delete(schema.internalNumbers).where(eq(schema.internalNumbers.id, id));
    return c.json({ ok: true });
  });

  app.get('/organizations/:id/hold-music', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('id'));
    if (!(await canReadOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
    if (!org) return c.json({ error: 'not_found' }, 404);
    let appearance: Record<string, unknown> = {};
    try {
      appearance = org.appearance ? JSON.parse(org.appearance) : {};
    } catch {
      appearance = {};
    }
    const holdMusic = (appearance.holdMusic as Record<string, unknown>) ?? { mode: 'default', audioFileId: null };
    return c.json({ holdMusic });
  });

  const holdMusicPatch = z.object({
    mode: z.enum(['default', 'custom']),
    audioFileId: z.number().nullable().optional(),
  });

  app.patch('/organizations/:id/hold-music', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('id'));
    const parsed = holdMusicPatch.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    if (!(await canWriteOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
    if (!org) return c.json({ error: 'not_found' }, 404);
    let appearance: Record<string, unknown> = {};
    try {
      appearance = org.appearance ? JSON.parse(org.appearance) : {};
    } catch {
      appearance = {};
    }
    appearance.holdMusic = parsed.data;
    await db
      .update(schema.organizations)
      .set({ appearance: JSON.stringify(appearance) })
      .where(eq(schema.organizations.id, orgId));
    return c.json({ holdMusic: parsed.data });
  });
}
