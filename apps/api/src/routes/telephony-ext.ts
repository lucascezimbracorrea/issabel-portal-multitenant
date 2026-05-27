import { and, eq, sql } from 'drizzle-orm';
import mysql from 'mysql2/promise';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { db as DbType } from '../db/client.js';
import * as schema from '../db/schema.js';
import {
  parseAmiFromEnv,
  parseAmiFromPbxApiJson,
  amiOriginateCall,
  amiMailboxCount,
  fetchQueueAmiMetrics,
} from '../lib/issabel-ami.js';
import { parseCdrConfig, globalCdrConfigFromEnv } from '../lib/issabel-cdr.js';
import { enqueueWebhookEvent, processPendingWebhookDeliveries } from '../lib/webhook-dispatcher.js';
import { processIssabelApplyJobs } from '../lib/issabel-apply-worker.js';
import { mapClientRow, mapLeadRow } from '../lib/lenslead-sync.js';

type Deps = {
  db: typeof DbType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSessionUser: (c: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  canReadOrg: (u: any, organizationId: number) => Promise<boolean>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  canWriteOrg: (u: any, organizationId: number) => Promise<boolean>;
};

function cronAuth(c: { req: { header: (n: string) => string | undefined; query: (n: string) => string | undefined } }): boolean {
  const secret = c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? c.req.query('secret');
  const expected = process.env.CRON_SECRET?.trim();
  return !!(expected && secret === expected);
}

export function registerTelephonyExtRoutes(app: Hono, deps: Deps) {
  const { db, getSessionUser, canReadOrg, canWriteOrg } = deps;

  app.get('/organizations/:orgId/telephony/ami-ping', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    if (!(await canReadOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
    if (!org) return c.json({ error: 'not_found' }, 404);
    const ami = parseAmiFromPbxApiJson(org.issabelPbxApi) ?? parseAmiFromEnv();
    if (!ami) return c.json({ ok: false, reason: 'ami_not_configured' });
    const queue = c.req.query('queue')?.trim() || 'default';
    const ext = c.req.query('extension')?.trim();
    const metrics = await fetchQueueAmiMetrics(ami, queue);
    let mailbox: { newMessages: number; oldMessages: number } | null = null;
    if (ext) {
      mailbox = await amiMailboxCount(ami, `${ext}@default`);
    }
    return c.json({
      ok: !!(metrics || mailbox),
      host: ami.host,
      port: ami.port,
      queue,
      metrics,
      mailbox,
    });
  });

  app.post('/organizations/:orgId/telephony/click-to-call', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    if (!(await canWriteOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const body = z
      .object({
        fromExtension: z.string().min(1).max(32),
        toNumber: z.string().min(3).max(32),
        leadId: z.number().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: 'invalid_body' }, 400);

    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
    if (!org) return c.json({ error: 'not_found' }, 404);
    const ami = parseAmiFromPbxApiJson(org.issabelPbxApi) ?? parseAmiFromEnv();
    if (!ami) return c.json({ error: 'ami_not_configured' }, 400);

    const result = await amiOriginateCall(ami, {
      fromExtension: body.data.fromExtension,
      toNumber: body.data.toNumber,
      callerId: body.data.fromExtension,
    });

    if (result.ok) {
      await enqueueWebhookEvent(db, orgId, 'call.click_to_call', {
        fromExtension: body.data.fromExtension,
        toNumber: body.data.toNumber,
        leadId: body.data.leadId ?? null,
      });
    }

    return c.json(result, result.ok ? 200 : 502);
  });

  app.get('/organizations/:orgId/billing-summary', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    if (!(await canReadOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
    if (!org) return c.json({ error: 'not_found' }, 404);

    const [{ count: extCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.extensions)
      .where(eq(schema.extensions.organizationId, orgId));

    const priceRow = await db
      .select()
      .from(schema.platformSettings)
      .where(eq(schema.platformSettings.key, 'billing'));
    let pricePerExtensionUsd = 39;
    try {
      const v = priceRow[0]?.value ? JSON.parse(priceRow[0].value) : {};
      if (typeof v.pricePerClientUsd === 'number') pricePerExtensionUsd = v.pricePerClientUsd;
    } catch {
      /* ignore */
    }

    let billableMinutes30d = 0;
    let cdrSource: 'cdr' | 'unconfigured' = 'unconfigured';
    const cdrCfg = org.cdrMysql?.trim() ? parseCdrConfig(org.cdrMysql) : globalCdrConfigFromEnv();
    if (cdrCfg) {
      cdrSource = 'cdr';
      const tbl = cdrCfg.table?.trim() || 'cdr';
      if (/^[a-zA-Z0-9_]+$/.test(tbl)) {
        let conn: mysql.Connection | null = null;
        try {
          conn = await mysql.createConnection({
            host: cdrCfg.host,
            port: cdrCfg.port ?? 3306,
            user: cdrCfg.user,
            password: cdrCfg.password,
            database: cdrCfg.database,
            connectTimeout: 8000,
          });
          const since = new Date();
          since.setDate(since.getDate() - 30);
          const sinceStr = since.toISOString().slice(0, 19).replace('T', ' ');
          const [rows] = await conn.query<mysql.RowDataPacket[]>(
            `SELECT COALESCE(SUM(billsec), 0) AS total FROM \`${tbl}\` WHERE calldate >= ? AND disposition = 'ANSWERED'`,
            [sinceStr],
          );
          billableMinutes30d = Math.round((Number(rows[0]?.total ?? 0) || 0) / 60);
        } catch {
          billableMinutes30d = 0;
        } finally {
          await conn?.end().catch(() => undefined);
        }
      }
    }

    return c.json({
      organizationId: orgId,
      extensionsCount: extCount,
      channelsLimit: org.channelsLimit ?? null,
      diskQuotaGb: org.diskQuotaGb ?? null,
      pricePerExtensionUsd,
      estimatedMrrUsd: extCount * pricePerExtensionUsd,
      billableMinutes30d,
      cdrSource,
    });
  });

  app.get('/organizations/:orgId/voicemail/mailboxes', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    if (!(await canReadOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
    if (!org) return c.json({ error: 'not_found' }, 404);

    const exts = await db
      .select()
      .from(schema.extensions)
      .where(eq(schema.extensions.organizationId, orgId))
      .limit(200);

    const ami = parseAmiFromPbxApiJson(org.issabelPbxApi) ?? parseAmiFromEnv();
    const items: Array<{
      extension: string;
      displayName: string;
      newMessages: number;
      oldMessages: number;
      source: 'ami' | 'unavailable';
    }> = [];

    for (const ext of exts) {
      if (ami) {
        const mb = await amiMailboxCount(ami, `${ext.number}@default`);
        items.push({
          extension: ext.number,
          displayName: ext.displayName,
          newMessages: mb?.newMessages ?? 0,
          oldMessages: mb?.oldMessages ?? 0,
          source: mb ? 'ami' : 'unavailable',
        });
      } else {
        items.push({
          extension: ext.number,
          displayName: ext.displayName,
          newMessages: 0,
          oldMessages: 0,
          source: 'unavailable',
        });
      }
    }

    return c.json({ source: ami ? 'ami' : 'unconfigured', items });
  });

  app.post('/webhooks/lenslead/inbound', async (c) => {
    const secret = c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const expected = process.env.PORTAL_SYNC_SECRET?.trim();
    if (!expected || secret !== expected) return c.json({ error: 'forbidden' }, 403);

    const body = z
      .object({
        organizationId: z.number(),
        event: z.enum(['lead.upsert', 'client.upsert', 'lead.delete']),
        lead: z.record(z.unknown()).optional(),
        client: z.record(z.unknown()).optional(),
        externalId: z.string().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: 'invalid_body' }, 400);

    const orgId = body.data.organizationId;
    const syncedAt = new Date().toISOString();

    if (body.data.event === 'lead.upsert' && body.data.lead) {
      const row = body.data.lead as Parameters<typeof mapLeadRow>[1];
      const mapped = mapLeadRow(orgId, row, syncedAt);
      await db
        .insert(schema.crmLeads)
        .values(mapped)
        .onDuplicateKeyUpdate({
          set: {
            name: mapped.name,
            email: mapped.email,
            phone: mapped.phone,
            phoneNormalized: mapped.phoneNormalized,
            status: mapped.status,
            source: mapped.source,
            rawJson: mapped.rawJson,
            syncedAt: mapped.syncedAt,
          },
        });
      await enqueueWebhookEvent(db, orgId, 'crm.lead.updated', { externalId: mapped.externalId });
    }

    if (body.data.event === 'client.upsert' && body.data.client) {
      const row = body.data.client as Parameters<typeof mapClientRow>[1];
      const mapped = mapClientRow(orgId, row, syncedAt);
      await db
        .insert(schema.crmClients)
        .values(mapped)
        .onDuplicateKeyUpdate({
          set: {
            name: mapped.name,
            email: mapped.email,
            phone: mapped.phone,
            phoneNormalized: mapped.phoneNormalized,
            leadExternalId: mapped.leadExternalId,
            rawJson: mapped.rawJson,
            syncedAt: mapped.syncedAt,
          },
        });
      await enqueueWebhookEvent(db, orgId, 'crm.client.updated', { externalId: mapped.externalId });
    }

    if (body.data.event === 'lead.delete' && body.data.externalId) {
      await db
        .delete(schema.crmLeads)
        .where(
          and(
            eq(schema.crmLeads.organizationId, orgId),
            eq(schema.crmLeads.externalId, body.data.externalId),
          ),
        );
    }

    return c.json({ ok: true });
  });

  app.get('/cron/dispatch-webhooks', async (c) => {
    if (!cronAuth(c)) return c.json({ error: 'forbidden' }, 403);
    const result = await processPendingWebhookDeliveries(db);
    return c.json({ ok: true, ...result });
  });

  app.get('/cron/issabel-apply-jobs', async (c) => {
    if (!cronAuth(c)) return c.json({ error: 'forbidden' }, 403);
    const results = await processIssabelApplyJobs(db);
    return c.json({ ok: true, results });
  });

  app.post('/campaigns/:id/sync-discador', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const id = Number(c.req.param('id'));
    const [row] = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, id));
    if (!row) return c.json({ error: 'not_found' }, 404);
    if (!(await canWriteOrg(u, row.organizationId))) return c.json({ error: 'forbidden' }, 403);
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, row.organizationId));
    if (!org?.issabelBaseUrl) {
      return c.json({ ok: false, detail: 'issabel_base_url_required' }, 400);
    }
    const discadorId = row.externalDiscadorId ?? `portal-campaign-${row.id}`;
    return c.json({
      ok: true,
      mode: 'stub',
      externalDiscadorId: discadorId,
      discadorUrl: `${org.issabelBaseUrl.replace(/\/+$/, '')}/modules/discador/`,
      note: 'Link campaign in Issabel discador UI; store returned ID in externalDiscadorId.',
    });
  });
}
