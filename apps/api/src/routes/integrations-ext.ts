import { and, eq, like, or, sql } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { db as DbType } from '../db/client.js';
import * as schema from '../db/schema.js';
import {
  fetchLensleadPage,
  mapClientRow,
  mapLeadRow,
  type LensleadConfig,
} from '../lib/lenslead-sync.js';
import { normalizePhone } from '../lib/phone-util.js';
import { parseIssabelPbxApiJson } from '../lib/issabel-pbx-api.js';
import { decryptSecret } from '../lib/crypto-util.js';
import { ramalCloudCheckout } from '../lib/issabel-ramal-cloud.js';
import { verifySoftphoneToken } from '../lib/jwt.js';
import { fetchIssabelIaAgents } from '../lib/issabel-ia-agents.js';

type Deps = {
  db: typeof DbType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSessionUser: (c: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  canReadOrg: (u: any, organizationId: number) => Promise<boolean>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  canWriteOrg: (u: any, organizationId: number) => Promise<boolean>;
};

function parseLensleadConfig(raw: string): LensleadConfig | null {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const functionsUrl =
      (typeof j.functionsUrl === 'string' ? j.functionsUrl : null) ||
      process.env.LENSLEAD_FUNCTIONS_URL?.trim() ||
      null;
    const syncSecret =
      (typeof j.syncSecret === 'string' ? j.syncSecret : null) ||
      process.env.PORTAL_SYNC_SECRET?.trim() ||
      null;
    const lensleadUserId = typeof j.lensleadUserId === 'string' ? j.lensleadUserId : null;
    if (!functionsUrl || !syncSecret || !lensleadUserId) return null;
    return { functionsUrl, syncSecret, lensleadUserId };
  } catch {
    return null;
  }
}

function safeMeta(raw: string | null): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const j = JSON.parse(raw) as unknown;
    return j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function syncLensleadForOrg(
  db: typeof DbType,
  orgId: number,
  cfg: LensleadConfig,
): Promise<{ leads: number; clients: number }> {
  const syncedAt = new Date().toISOString();
  let since: string | null = null;
  let leads = 0;
  let clients = 0;
  let page = 1;
  let hasMore = true;
  while (hasMore && page <= 50) {
    const batch = await fetchLensleadPage({ cfg, since, page, pageSize: 100 });
    for (const row of batch.leads) {
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
      leads++;
    }
    for (const row of batch.clients) {
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
      clients++;
    }
    since = batch.nextSince ?? since;
    hasMore = batch.hasMore;
    page++;
  }
  return { leads, clients };
}

export function registerIntegrationsExtRoutes(app: Hono, deps: Deps) {
  const { db, getSessionUser, canReadOrg, canWriteOrg } = deps;

  app.get('/organizations/:orgId/issabel/ia-agents', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    if (!(await canReadOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
    if (!org) return c.json({ error: 'not_found' }, 404);
    const result = await fetchIssabelIaAgents({
      issabelPbxApiRaw: org.issabelPbxApi,
      issabelBaseUrl: org.issabelBaseUrl,
    });
    if (!result.ok) return c.json({ configured: false, error: result.detail, items: [] });
    return c.json({ configured: true, items: result.items });
  });

  app.get('/organizations/:orgId/crm/contacts', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    if (!(await canReadOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const q = (c.req.query('q') ?? '').trim();
    const phoneQ = normalizePhone(q);
    const leadCond = phoneQ
      ? and(
          eq(schema.crmLeads.organizationId, orgId),
          or(
            like(schema.crmLeads.name, `%${q}%`),
            eq(schema.crmLeads.phoneNormalized, phoneQ),
          ),
        )
      : q
        ? and(eq(schema.crmLeads.organizationId, orgId), like(schema.crmLeads.name, `%${q}%`))
        : eq(schema.crmLeads.organizationId, orgId);
    const leads = await db.select().from(schema.crmLeads).where(leadCond).limit(30);
    const clients = await db
      .select()
      .from(schema.crmClients)
      .where(
        q
          ? and(
              eq(schema.crmClients.organizationId, orgId),
              or(
                like(schema.crmClients.name, `%${q}%`),
                phoneQ ? eq(schema.crmClients.phoneNormalized, phoneQ) : sql`1=0`,
              ),
            )
          : eq(schema.crmClients.organizationId, orgId),
      )
      .limit(30);
    return c.json({
      leads: leads.map((l) => ({ ...l, kind: 'lead' as const })),
      clients: clients.map((cl) => ({ ...cl, kind: 'client' as const })),
    });
  });

  app.get('/organizations/:orgId/integrations/lenslead', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    if (!(await canReadOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const rows = await db
      .select()
      .from(schema.integrations)
      .where(and(eq(schema.integrations.organizationId, orgId), eq(schema.integrations.type, 'lenslead')));
    const row = rows[0];
    if (!row) return c.json({ configured: false });
    const cfg = JSON.parse(row.config) as Record<string, unknown>;
    return c.json({
      configured: true,
      enabled: row.enabled,
      status: row.status,
      lensleadUserId: cfg.lensleadUserId,
      functionsUrl: cfg.functionsUrl,
      lastSyncedAt: cfg.lastSyncedAt ?? null,
      syncSecret: '********',
    });
  });

  app.put('/organizations/:orgId/integrations/lenslead', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    if (!(await canWriteOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const b = z
      .object({
        lensleadUserId: z.string().uuid(),
        functionsUrl: z.string().url().optional(),
        syncSecret: z.string().min(8).optional(),
        enabled: z.boolean().optional(),
      })
      .safeParse(await c.req.json());
    if (!b.success) return c.json({ error: 'invalid_body' }, 400);
    const rows = await db
      .select()
      .from(schema.integrations)
      .where(and(eq(schema.integrations.organizationId, orgId), eq(schema.integrations.type, 'lenslead')));
    const existing = rows[0];
    let prev: Record<string, unknown> = {};
    if (existing) {
      try {
        prev = JSON.parse(existing.config) as Record<string, unknown>;
      } catch {
        prev = {};
      }
    }
    const config = {
      ...prev,
      lensleadUserId: b.data.lensleadUserId,
      functionsUrl:
        b.data.functionsUrl ??
        prev.functionsUrl ??
        process.env.LENSLEAD_FUNCTIONS_URL ??
        '',
      syncSecret:
        b.data.syncSecret && b.data.syncSecret !== '********'
          ? b.data.syncSecret
          : prev.syncSecret ?? process.env.PORTAL_SYNC_SECRET ?? '',
    };
    if (existing) {
      await db
        .update(schema.integrations)
        .set({
          config: JSON.stringify(config),
          enabled: b.data.enabled ?? existing.enabled,
          status: 'active',
        })
        .where(eq(schema.integrations.id, existing.id));
    } else {
      await db.insert(schema.integrations).values({
        organizationId: orgId,
        type: 'lenslead',
        config: JSON.stringify(config),
        status: 'active',
        enabled: b.data.enabled ?? true,
      });
    }
    return c.json({ ok: true });
  });

  app.post('/organizations/:orgId/integrations/lenslead/sync', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    if (!(await canWriteOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const rows = await db
      .select()
      .from(schema.integrations)
      .where(
        and(
          eq(schema.integrations.organizationId, orgId),
          eq(schema.integrations.type, 'lenslead'),
          eq(schema.integrations.enabled, true),
        ),
      );
    const row = rows[0];
    if (!row) return c.json({ error: 'not_configured' }, 400);
    const cfg = parseLensleadConfig(row.config);
    if (!cfg) return c.json({ error: 'invalid_config' }, 400);
    try {
      const result = await syncLensleadForOrg(db, orgId, cfg);
      const prev = JSON.parse(row.config) as Record<string, unknown>;
      await db
        .update(schema.integrations)
        .set({
          config: JSON.stringify({ ...prev, lastSyncedAt: new Date().toISOString() }),
          status: 'active',
        })
        .where(eq(schema.integrations.id, row.id));
      return c.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.update(schema.integrations).set({ status: 'error' }).where(eq(schema.integrations.id, row.id));
      return c.json({ error: 'sync_failed', detail: msg.slice(0, 500) }, 502);
    }
  });

  app.get('/organizations/:orgId/softphone/provision', async (c) => {
    const orgId = Number(c.req.param('orgId'));
    let u = await getSessionUser(c);
    const bearer = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
    if (!u && bearer) {
      try {
        const st = await verifySoftphoneToken(bearer);
        if (st.orgId !== orgId) return c.json({ error: 'forbidden' }, 403);
        const [row] = await db.select().from(schema.users).where(eq(schema.users.id, st.sub));
        if (!row) return c.json({ error: 'unauthorized' }, 401);
        u = { ...row, tokenRole: row.role };
      } catch {
        return c.json({ error: 'unauthorized' }, 401);
      }
    }
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    if (!(await canReadOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const extId = c.req.query('extensionId');
    const stayId = c.req.query('stayId');
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
    if (!org) return c.json({ error: 'not_found' }, 404);

    if (stayId) {
      const sid = Number(stayId);
      const [stay] = await db.select().from(schema.hotelStays).where(eq(schema.hotelStays.id, sid));
      const sipPass = decryptSecret(stay.ramalPassEnc);
      if (!sipPass) return c.json({ error: 'no_credentials' }, 404);
      const [room] = await db.select().from(schema.hotelRooms).where(eq(schema.hotelRooms.id, stay.roomId));
      if (!room) return c.json({ error: 'room_not_found' }, 404);
      const host =
        stay.ramalDomain?.replace(/^https?:\/\//, '').split('/')[0] ??
        (org.issabelBaseUrl ? new URL(org.issabelBaseUrl).hostname : 'localhost');
      const pushBase = org.issabelBaseUrl ?? `https://${host}`;
      return c.json({
        host,
        port: 8089,
        username: room.extensionNumber,
        password: sipPass,
        displayName: stay.guestName,
        useTls: true,
        wssUrl: `wss://${host}:8089/ws`,
        pushRegisterUrl: `${pushBase.replace(/\/+$/, '')}/api/register_push_token.php`,
        deepLink: `softphone://provision?host=${encodeURIComponent(host)}&port=8089&username=${encodeURIComponent(room.extensionNumber)}&password=${encodeURIComponent(sipPass)}&displayName=${encodeURIComponent(stay.guestName)}&useTls=1`,
      });
    }

    if (!extId) return c.json({ error: 'extensionId_or_stayId_required' }, 400);
    const [ext] = await db
      .select()
      .from(schema.extensions)
      .where(and(eq(schema.extensions.id, Number(extId)), eq(schema.extensions.organizationId, orgId)));
    if (!ext) return c.json({ error: 'extension_not_found' }, 404);
    const meta = safeMeta(ext.metadata);
    const sipSecret =
      typeof meta.sipSecret === 'string'
        ? meta.sipSecret
        : typeof meta.sipPassword === 'string'
          ? meta.sipPassword
          : typeof meta.secret === 'string'
            ? meta.secret
            : '';
    const pbxCfg = parseIssabelPbxApiJson(org.issabelPbxApi);
    const host = pbxCfg
      ? new URL(pbxCfg.baseUrl).hostname
      : org.issabelBaseUrl
        ? new URL(org.issabelBaseUrl).hostname
        : 'localhost';
    const pushBase = org.issabelBaseUrl ?? pbxCfg?.baseUrl ?? `https://${host}`;
    if (!sipSecret) {
      return c.json({
        host,
        port: 8089,
        username: ext.number,
        password: null,
        displayName: ext.displayName,
        useTls: true,
        wssUrl: `wss://${host}:8089/ws`,
        pushRegisterUrl: `${pushBase.replace(/\/+$/, '')}/api/register_push_token.php`,
        warning: 'sip_secret_missing_in_metadata',
      });
    }
    return c.json({
      host,
      port: 8089,
      username: ext.number,
      password: sipSecret,
      displayName: ext.displayName,
      useTls: true,
      wssUrl: `wss://${host}:8089/ws`,
      pushRegisterUrl: `${pushBase.replace(/\/+$/, '')}/api/register_push_token.php`,
      deepLink: `softphone://provision?host=${encodeURIComponent(host)}&port=8089&username=${encodeURIComponent(ext.number)}&password=${encodeURIComponent(sipSecret)}&displayName=${encodeURIComponent(ext.displayName)}&useTls=1`,
    });
  });

  app.get('/cron/sync-lenslead', async (c) => {
    const secret = c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? c.req.query('secret');
    const expected = process.env.CRON_SECRET?.trim();
    if (!expected || secret !== expected) return c.json({ error: 'forbidden' }, 403);

    const integrations = await db
      .select()
      .from(schema.integrations)
      .where(and(eq(schema.integrations.type, 'lenslead'), eq(schema.integrations.enabled, true)));

    const results: Array<{ orgId: number; leads: number; clients: number; error?: string }> = [];
    for (const row of integrations) {
      const cfg = parseLensleadConfig(row.config);
      if (!cfg) {
        results.push({ orgId: row.organizationId, leads: 0, clients: 0, error: 'invalid_config' });
        continue;
      }
      try {
        const r = await syncLensleadForOrg(db, row.organizationId, cfg);
        const prev = JSON.parse(row.config) as Record<string, unknown>;
        await db
          .update(schema.integrations)
          .set({
            config: JSON.stringify({ ...prev, lastSyncedAt: new Date().toISOString() }),
            status: 'active',
          })
          .where(eq(schema.integrations.id, row.id));
        results.push({ orgId: row.organizationId, ...r });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ orgId: row.organizationId, leads: 0, clients: 0, error: msg.slice(0, 200) });
      }
    }
    return c.json({ ok: true, results });
  });

  app.get('/cron/hotel-auto-checkout', async (c) => {
    const secret = c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? c.req.query('secret');
    const expected = process.env.CRON_SECRET?.trim();
    if (!expected || secret !== expected) return c.json({ error: 'forbidden' }, 403);

    const now = new Date().toISOString();
    const activeStays = await db
      .select()
      .from(schema.hotelStays)
      .where(eq(schema.hotelStays.status, 'active'));
    const due = activeStays.filter(
      (s) => s.plannedCheckOut && s.plannedCheckOut <= now,
    );
    const results: Array<{ stayId: number; ok: boolean; error?: string }> = [];

    for (const stay of due) {
      try {
        const [room] = await db.select().from(schema.hotelRooms).where(eq(schema.hotelRooms.id, stay.roomId));
        if (!room) {
          results.push({ stayId: stay.id, ok: false, error: 'room_not_found' });
          continue;
        }
        const [prop] = await db
          .select()
          .from(schema.hotelProperties)
          .where(eq(schema.hotelProperties.id, room.propertyId));
        if (!prop) {
          results.push({ stayId: stay.id, ok: false, error: 'property_not_found' });
          continue;
        }
        const apiBase = (prop.ramalCloudApiBase || prop.ipbxUrl).replace(/\/+$/, '');
        await ramalCloudCheckout({
          cfg: { apiBase, tokenSecret: prop.tokenSecret },
          ipbxUrl: prop.ipbxUrl,
          ramal: room.extensionNumber,
          hotelId: prop.externalHotelId,
          roomNumber: room.roomNumber,
        });
        await db
          .update(schema.hotelStays)
          .set({ status: 'checked_out', checkedOutAt: now, ramalPassEnc: null })
          .where(eq(schema.hotelStays.id, stay.id));
        await db.update(schema.hotelRooms).set({ status: 'vacant' }).where(eq(schema.hotelRooms.id, room.id));
        await db.insert(schema.hotelInteractionLogs).values({
          organizationId: prop.organizationId,
          roomId: room.id,
          stayId: stay.id,
          type: 'auto_check_out',
          metadataJson: JSON.stringify({ plannedCheckOut: stay.plannedCheckOut }),
        });
        results.push({ stayId: stay.id, ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ stayId: stay.id, ok: false, error: msg.slice(0, 200) });
      }
    }
    return c.json({ ok: true, processed: results.length, results });
  });
}
