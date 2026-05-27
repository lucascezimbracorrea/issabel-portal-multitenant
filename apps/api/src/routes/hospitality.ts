import { and, desc, eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { db as DbType } from '../db/client.js';
import * as schema from '../db/schema.js';
import {
  ramalCloudCheckin,
  ramalCloudCheckout,
  ramalCloudDisconnect,
  ramalCloudPollPassword,
  type RamalCloudConfig,
} from '../lib/issabel-ramal-cloud.js';
import { decryptSecret, encryptSecret } from '../lib/crypto-util.js';

type Deps = {
  db: typeof DbType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSessionUser: (c: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  canReadOrg: (u: any, organizationId: number) => Promise<boolean>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  canWriteOrg: (u: any, organizationId: number) => Promise<boolean>;
};

function ramalCfgFromProperty(p: typeof schema.hotelProperties.$inferSelect): RamalCloudConfig {
  const apiBase = (p.ramalCloudApiBase || p.ipbxUrl).replace(/\/+$/, '');
  return { apiBase, tokenSecret: p.tokenSecret };
}

function maskPass(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const plain = decryptSecret(stored) ?? stored;
  if (plain.length <= 4) return '****';
  return `****${plain.slice(-4)}`;
}

async function logHotel(
  db: typeof DbType,
  params: {
    organizationId: number;
    roomId?: number;
    stayId?: number;
    type: string;
    metadata?: Record<string, unknown>;
  },
) {
  await db.insert(schema.hotelInteractionLogs).values({
    organizationId: params.organizationId,
    roomId: params.roomId ?? null,
    stayId: params.stayId ?? null,
    type: params.type,
    metadataJson: JSON.stringify(params.metadata ?? {}),
  });
}

export function registerHospitalityRoutes(app: Hono, deps: Deps) {
  const { db, getSessionUser, canReadOrg, canWriteOrg } = deps;

  app.get('/organizations/:orgId/hospitality/properties', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    if (!(await canReadOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const items = await db
      .select()
      .from(schema.hotelProperties)
      .where(eq(schema.hotelProperties.organizationId, orgId));
    return c.json({
      items: items.map((p) => ({ ...p, tokenSecret: '********' })),
    });
  });

  app.post('/organizations/:orgId/hospitality/properties', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    if (!(await canWriteOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const b = z
      .object({
        name: z.string().min(1),
        externalHotelId: z.string().min(1),
        ipbxUrl: z.string().url(),
        ramalCloudApiBase: z.string().url().optional(),
        tokenSecret: z.string().min(1).optional(),
      })
      .safeParse(await c.req.json());
    if (!b.success) return c.json({ error: 'invalid_body', details: b.error.flatten() }, 400);
    const [res] = await db.insert(schema.hotelProperties).values({
      organizationId: orgId,
      name: b.data.name,
      externalHotelId: b.data.externalHotelId,
      ipbxUrl: b.data.ipbxUrl,
      ramalCloudApiBase: b.data.ramalCloudApiBase ?? null,
      tokenSecret: b.data.tokenSecret ?? 'i360-pswd',
    }) as unknown as [{ insertId: number }];
    const [row] = await db
      .select()
      .from(schema.hotelProperties)
      .where(eq(schema.hotelProperties.id, res.insertId));
    return c.json({ ...row, tokenSecret: '********' }, 201);
  });

  app.get('/organizations/:orgId/hospitality/rooms', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    if (!(await canReadOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const props = await db
      .select()
      .from(schema.hotelProperties)
      .where(eq(schema.hotelProperties.organizationId, orgId));
    if (props.length === 0) return c.json({ items: [] });
    const propIds = props.map((p) => p.id);
    const rooms = await db.select().from(schema.hotelRooms);
    const items = rooms.filter((r) => propIds.includes(r.propertyId));
    const activeStays = await db
      .select()
      .from(schema.hotelStays)
      .where(eq(schema.hotelStays.status, 'active'));
    return c.json({
      properties: props.map((p) => ({ id: p.id, name: p.name })),
      items: items.map((room) => {
        const stay = activeStays.find((s) => s.roomId === room.id);
        return {
          ...room,
          activeStay: stay
            ? {
                id: stay.id,
                guestName: stay.guestName,
                checkedInAt: stay.checkedInAt,
                passwordHint: maskPass(stay.ramalPassEnc),
              }
            : null,
        };
      }),
    });
  });

  app.post('/organizations/:orgId/hospitality/rooms', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    if (!(await canWriteOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const b = z
      .object({
        propertyId: z.number(),
        roomNumber: z.string().min(1),
        extensionNumber: z.string().min(1),
        extensionId: z.number().optional(),
        floor: z.string().optional(),
        notes: z.string().optional(),
      })
      .safeParse(await c.req.json());
    if (!b.success) return c.json({ error: 'invalid_body' }, 400);
    const [prop] = await db
      .select()
      .from(schema.hotelProperties)
      .where(
        and(
          eq(schema.hotelProperties.id, b.data.propertyId),
          eq(schema.hotelProperties.organizationId, orgId),
        ),
      );
    if (!prop) return c.json({ error: 'property_not_found' }, 404);
    const [res] = await db.insert(schema.hotelRooms).values({
      propertyId: b.data.propertyId,
      roomNumber: b.data.roomNumber,
      extensionNumber: b.data.extensionNumber,
      extensionId: b.data.extensionId ?? null,
      floor: b.data.floor ?? null,
      notes: b.data.notes ?? null,
      status: 'vacant',
    }) as unknown as [{ insertId: number }];
    const [row] = await db.select().from(schema.hotelRooms).where(eq(schema.hotelRooms.id, res.insertId));
    return c.json(row, 201);
  });

  app.post('/organizations/:orgId/hospitality/rooms/import', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    if (!(await canWriteOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const b = z
      .object({
        propertyId: z.number(),
        rows: z.array(
          z.object({
            roomNumber: z.string(),
            extensionNumber: z.string(),
            floor: z.string().optional(),
          }),
        ),
      })
      .safeParse(await c.req.json());
    if (!b.success) return c.json({ error: 'invalid_body' }, 400);
    const [prop] = await db
      .select()
      .from(schema.hotelProperties)
      .where(
        and(
          eq(schema.hotelProperties.id, b.data.propertyId),
          eq(schema.hotelProperties.organizationId, orgId),
        ),
      );
    if (!prop) return c.json({ error: 'property_not_found' }, 404);
    let created = 0;
    for (const row of b.data.rows) {
      await db.insert(schema.hotelRooms).values({
        propertyId: b.data.propertyId,
        roomNumber: row.roomNumber,
        extensionNumber: row.extensionNumber,
        floor: row.floor ?? null,
        status: 'vacant',
      });
      created++;
    }
    return c.json({ created });
  });

  app.patch('/organizations/:orgId/hospitality/rooms/:roomId', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    const roomId = Number(c.req.param('roomId'));
    if (!(await canWriteOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const b = z
      .object({
        extensionNumber: z.string().optional(),
        extensionId: z.number().nullable().optional(),
        status: z.enum(['vacant', 'occupied', 'maintenance']).optional(),
        floor: z.string().optional(),
        notes: z.string().optional(),
      })
      .safeParse(await c.req.json());
    if (!b.success) return c.json({ error: 'invalid_body' }, 400);
    const [room] = await db.select().from(schema.hotelRooms).where(eq(schema.hotelRooms.id, roomId));
    if (!room) return c.json({ error: 'not_found' }, 404);
    const [prop] = await db
      .select()
      .from(schema.hotelProperties)
      .where(eq(schema.hotelProperties.id, room.propertyId));
    if (!prop || prop.organizationId !== orgId) return c.json({ error: 'forbidden' }, 403);
    await db
      .update(schema.hotelRooms)
      .set({
        ...(b.data.extensionNumber !== undefined ? { extensionNumber: b.data.extensionNumber } : {}),
        ...(b.data.extensionId !== undefined ? { extensionId: b.data.extensionId } : {}),
        ...(b.data.status !== undefined ? { status: b.data.status } : {}),
        ...(b.data.floor !== undefined ? { floor: b.data.floor } : {}),
        ...(b.data.notes !== undefined ? { notes: b.data.notes } : {}),
      })
      .where(eq(schema.hotelRooms.id, roomId));
    const [next] = await db.select().from(schema.hotelRooms).where(eq(schema.hotelRooms.id, roomId));
    return c.json(next);
  });

  app.post('/organizations/:orgId/hospitality/rooms/:roomId/check-in', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    const roomId = Number(c.req.param('roomId'));
    if (!(await canWriteOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const b = z
      .object({
        guestName: z.string().min(1),
        plannedCheckOut: z.string().optional(),
      })
      .safeParse(await c.req.json());
    if (!b.success) return c.json({ error: 'invalid_body' }, 400);
    const [room] = await db.select().from(schema.hotelRooms).where(eq(schema.hotelRooms.id, roomId));
    if (!room) return c.json({ error: 'not_found' }, 404);
    if (room.status === 'occupied') return c.json({ error: 'room_occupied' }, 409);
    const [prop] = await db
      .select()
      .from(schema.hotelProperties)
      .where(eq(schema.hotelProperties.id, room.propertyId));
    if (!prop || prop.organizationId !== orgId) return c.json({ error: 'forbidden' }, 403);

    const cfg = ramalCfgFromProperty(prop);
    const now = new Date().toISOString();
    const checkinRes = await ramalCloudCheckin({
      cfg,
      ipbxUrl: prop.ipbxUrl,
      ramal: room.extensionNumber,
      hotelId: prop.externalHotelId,
      roomNumber: room.roomNumber,
    });

    const [stayRes] = await db.insert(schema.hotelStays).values({
      roomId,
      guestName: b.data.guestName,
      status: 'pending',
      jobId: checkinRes.job_id ?? null,
      plannedCheckOut: b.data.plannedCheckOut ?? null,
      checkedInAt: now,
    }) as unknown as [{ insertId: number }];

    await logHotel(db, {
      organizationId: orgId,
      roomId,
      stayId: stayRes.insertId,
      type: 'check_in_requested',
      metadata: { jobId: checkinRes.job_id, guestName: b.data.guestName },
    });

    let pass = checkinRes.ramal_pass ?? null;
    let domain = checkinRes.ramal_domain ?? null;
    if (!pass) {
      const polled = await ramalCloudPollPassword({ cfg, ramal: room.extensionNumber });
      pass = polled.ramal_pass ?? null;
      domain = polled.ramal_domain ?? domain;
    }

    const status = pass ? 'active' : 'pending';
    const storedPass = pass ? encryptSecret(pass) : null;
    await db
      .update(schema.hotelStays)
      .set({
        status,
        ramalPassEnc: storedPass,
        ramalDomain: domain,
      })
      .where(eq(schema.hotelStays.id, stayRes.insertId));
    if (pass) {
      await db
        .update(schema.hotelRooms)
        .set({ status: 'occupied' })
        .where(eq(schema.hotelRooms.id, roomId));
    }

    const [stay] = await db.select().from(schema.hotelStays).where(eq(schema.hotelStays.id, stayRes.insertId));
    if (pass) {
      await logHotel(db, {
        organizationId: orgId,
        roomId,
        stayId: stayRes.insertId,
        type: 'check_in_active',
        metadata: { extension: room.extensionNumber },
      });
    }
    return c.json({
      stay: { ...stay, ramalPassEnc: undefined, passwordHint: maskPass(storedPass) },
      checkin: checkinRes,
      provision: pass
        ? {
            host: domain ?? new URL(prop.ipbxUrl).hostname,
            port: 8089,
            username: room.extensionNumber,
            password: pass,
            displayName: b.data.guestName,
            useTls: true,
          }
        : null,
    });
  });

  app.post('/organizations/:orgId/hospitality/rooms/:roomId/check-out', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    const roomId = Number(c.req.param('roomId'));
    if (!(await canWriteOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const [room] = await db.select().from(schema.hotelRooms).where(eq(schema.hotelRooms.id, roomId));
    if (!room) return c.json({ error: 'not_found' }, 404);
    const [prop] = await db
      .select()
      .from(schema.hotelProperties)
      .where(eq(schema.hotelProperties.id, room.propertyId));
    if (!prop || prop.organizationId !== orgId) return c.json({ error: 'forbidden' }, 403);
    const cfg = ramalCfgFromProperty(prop);
    const checkoutRes = await ramalCloudCheckout({
      cfg,
      ipbxUrl: prop.ipbxUrl,
      ramal: room.extensionNumber,
      hotelId: prop.externalHotelId,
      roomNumber: room.roomNumber,
    });
    const now = new Date().toISOString();
    const activeStays = await db
      .select()
      .from(schema.hotelStays)
      .where(and(eq(schema.hotelStays.roomId, roomId), eq(schema.hotelStays.status, 'active')));
    for (const s of activeStays) {
      await db
        .update(schema.hotelStays)
        .set({ status: 'checked_out', checkedOutAt: now, ramalPassEnc: null })
        .where(eq(schema.hotelStays.id, s.id));
    }
    await db.update(schema.hotelRooms).set({ status: 'vacant' }).where(eq(schema.hotelRooms.id, roomId));
    await logHotel(db, {
      organizationId: orgId,
      roomId,
      type: 'check_out',
      metadata: { jobId: checkoutRes.job_id },
    });
    return c.json({ checkout: checkoutRes });
  });

  app.get('/organizations/:orgId/hospitality/logs', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    if (!(await canReadOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const items = await db
      .select()
      .from(schema.hotelInteractionLogs)
      .where(eq(schema.hotelInteractionLogs.organizationId, orgId))
      .orderBy(desc(schema.hotelInteractionLogs.id))
      .limit(100);
    return c.json({ items });
  });

  app.post('/organizations/:orgId/hospitality/rooms/:roomId/disconnect', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    const roomId = Number(c.req.param('roomId'));
    if (!(await canWriteOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const [room] = await db.select().from(schema.hotelRooms).where(eq(schema.hotelRooms.id, roomId));
    if (!room) return c.json({ error: 'not_found' }, 404);
    const [prop] = await db
      .select()
      .from(schema.hotelProperties)
      .where(eq(schema.hotelProperties.id, room.propertyId));
    if (!prop || prop.organizationId !== orgId) return c.json({ error: 'forbidden' }, 403);
    const cfg = ramalCfgFromProperty(prop);
    const res = await ramalCloudDisconnect({
      cfg,
      ipbxUrl: prop.ipbxUrl,
      ramal: room.extensionNumber,
      hotelId: prop.externalHotelId,
      roomNumber: room.roomNumber,
    });
    return c.json(res);
  });

  app.get('/organizations/:orgId/hospitality/stays', async (c) => {
    const u = await getSessionUser(c);
    if (!u) return c.json({ error: 'unauthorized' }, 401);
    const orgId = Number(c.req.param('orgId'));
    if (!(await canReadOrg(u, orgId))) return c.json({ error: 'forbidden' }, 403);
    const props = await db
      .select()
      .from(schema.hotelProperties)
      .where(eq(schema.hotelProperties.organizationId, orgId));
    const propIds = new Set(props.map((p) => p.id));
    const rooms = (await db.select().from(schema.hotelRooms)).filter((r) => propIds.has(r.propertyId));
    const roomIds = new Set(rooms.map((r) => r.id));
    const stays = await db.select().from(schema.hotelStays).orderBy(desc(schema.hotelStays.id));
    return c.json({
      items: stays
        .filter((s) => roomIds.has(s.roomId))
        .map((s) => ({ ...s, ramalPassEnc: maskPass(s.ramalPassEnc) })),
    });
  });
}
