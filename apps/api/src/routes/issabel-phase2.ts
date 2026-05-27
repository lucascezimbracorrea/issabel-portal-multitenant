import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import type { db as DbType } from '../db/client.js';
import * as schema from '../db/schema.js';
import { parseCdrConfig, globalCdrConfigFromEnv } from '../lib/issabel-cdr.js';
import { parseAmiFromPbxApiJson, parseAmiFromEnv, fetchQueueAmiMetrics } from '../lib/issabel-ami.js';
import { fetchQueueMetricsFromQueueLog } from '../lib/queue-metrics.js';
import { syncTrunkToIssabel } from '../lib/issabel-trunk-sync.js';
import { syncInboundToIssabel } from '../lib/issabel-inbound-sync.js';
import { enqueueApplyJob } from '../lib/issabel-apply-worker.js';
import { buildUraAiBundle } from '../lib/issabel-ia-agents.js';

type Deps = {
  db: typeof DbType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSessionUser: (c: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  canReadOrg: (u: any, organizationId: number) => Promise<boolean>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  canWriteOrg: (u: any, organizationId: number) => Promise<boolean>;
};

export function registerIssabelPhase2Routes(app: Hono, deps: Deps) {
  const { db, getSessionUser, canReadOrg, canWriteOrg } = deps;

  app.post('/trunks/:id/sync-issabel', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [trunk] = await db.select().from(schema.trunks).where(eq(schema.trunks.id, id));
    if (!trunk) return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, trunk.organizationId))) return c.json({ error: 'forbidden' }, 403);
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, trunk.organizationId));
    const result = await syncTrunkToIssabel({
      issabelPbxApiRaw: org?.issabelPbxApi ?? null,
      trunk: {
        id: trunk.id,
        name: trunk.name,
        host: trunk.host,
        username: trunk.username,
        password: trunk.password,
        status: trunk.status,
        type: trunk.type,
      },
      mode: 'update',
    });
    return c.json(result);
  });

  app.post('/call-flows/:id/export-issabel', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [flow] = await db.select().from(schema.callFlows).where(eq(schema.callFlows.id, id));
    if (!flow) return c.json({ error: 'not_found' }, 404);
    if (!(await canReadOrg(u, flow.organizationId))) return c.json({ error: 'forbidden' }, 403);
    const graph = JSON.parse(flow.graphJson || '{}') as { nodes?: unknown[]; edges?: unknown[] };
    return c.json({
      ok: true,
      format: 'portal-call-flow-v1',
      name: flow.name,
      extensionNumber: flow.extensionNumber,
      graph,
      note: 'Export bundle for Issabel apply job — dialplan push not automated yet.',
    });
  });

  app.post('/uras/:id/export-issabel', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [ura] = await db.select().from(schema.uras).where(eq(schema.uras.id, id));
    if (!ura) return c.json({ error: 'not_found' }, 404);
    if (!(await canReadOrg(u, ura.organizationId))) return c.json({ error: 'forbidden' }, 403);
    return c.json({
      ok: true,
      format: 'portal-ura-v1',
      name: ura.name,
      extensionNumber: ura.extensionNumber,
      dtmfActions: JSON.parse(ura.dtmfActionsJson || '[]'),
      graph: JSON.parse(ura.graphJson || '{}'),
      note: 'Export bundle for Issabel IVR module — apply job not automated yet.',
    });
  });

  app.post('/inbound-numbers/:id/sync-issabel', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.inboundNumbers).where(eq(schema.inboundNumbers.id, id));
    if (!row) return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId))) return c.json({ error: 'forbidden' }, 403);
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, row.organizationId));
    const result = await syncInboundToIssabel({
      issabelPbxApiRaw: org?.issabelPbxApi ?? null,
      inbound: row,
    });
    return c.json(result);
  });

  app.post('/call-flows/:id/apply-issabel', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [flow] = await db.select().from(schema.callFlows).where(eq(schema.callFlows.id, id));
    if (!flow) return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, flow.organizationId))) return c.json({ error: 'forbidden' }, 403);
    const graph = JSON.parse(flow.graphJson || '{}') as { nodes?: unknown[]; edges?: unknown[] };
    const bundle = {
      format: 'portal-call-flow-v1',
      name: flow.name,
      extensionNumber: flow.extensionNumber,
      graph,
      appliedAt: new Date().toISOString(),
      status: 'pending_apply',
    };
    const jobId = await enqueueApplyJob(db, {
      organizationId: flow.organizationId,
      resourceType: 'call_flow',
      resourceId: id,
      bundle,
    });
    await db
      .update(schema.callFlows)
      .set({
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.callFlows.id, id));
    return c.json({ ok: true, bundle, jobId, status: 'pending_apply' });
  });

  app.post('/uras/:id/apply-issabel', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [ura] = await db.select().from(schema.uras).where(eq(schema.uras.id, id));
    if (!ura) return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, ura.organizationId))) return c.json({ error: 'forbidden' }, 403);
    const bundle = buildUraAiBundle(ura);
    const jobId = await enqueueApplyJob(db, {
      organizationId: ura.organizationId,
      resourceType: 'ura',
      resourceId: id,
      bundle,
    });
    await db.update(schema.uras).set({ updatedAt: new Date().toISOString() }).where(eq(schema.uras.id, id));
    return c.json({ ok: true, bundle, jobId, status: 'pending_apply' });
  });

  app.get('/queues/:id/ami-metrics', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [queue] = await db.select().from(schema.queues).where(eq(schema.queues.id, id));
    if (!queue) return c.json({ error: 'not_found' }, 404);
    if (!(await canReadOrg(u, queue.organizationId))) return c.json({ error: 'forbidden' }, 403);
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, queue.organizationId));
    const ami =
      parseAmiFromPbxApiJson(org?.issabelPbxApi) ?? parseAmiFromEnv();
    const queueName = queue.queueCode ?? queue.name;
    if (!ami) return c.json({ available: false, reason: 'ami_not_configured' });
    const metrics = await fetchQueueAmiMetrics(ami, queueName);
    if (!metrics) return c.json({ available: false, reason: 'ami_unreachable', queueName });
    return c.json({ available: true, metrics });
  });
}

/** Shared helper for queue dashboard — used from pbx-audit. */
export async function resolveQueueMetrics(
  db: typeof DbType,
  queue: typeof schema.queues.$inferSelect,
  orgIssabelPbxApi: string | null,
  orgCdrMysql: string | null,
  fallback: () => Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const queueName = queue.queueCode ?? queue.name;
  const cdrCfg = orgCdrMysql?.trim() ? parseCdrConfig(orgCdrMysql) : globalCdrConfigFromEnv();
  if (cdrCfg) {
    const fromLog = await fetchQueueMetricsFromQueueLog(cdrCfg, queueName);
    if (fromLog) return fromLog;
  }
  const ami = parseAmiFromPbxApiJson(orgIssabelPbxApi) ?? parseAmiFromEnv();
  if (ami) {
    const m = await fetchQueueAmiMetrics(ami, queueName);
    if (m) return m;
  }
  return fallback();
}
