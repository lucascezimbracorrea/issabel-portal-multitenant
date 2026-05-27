import { createHmac } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { db as DbType } from '../db/client.js';
import * as schema from '../db/schema.js';

function endpointWantsEvent(eventTypesJson: string, eventType: string): boolean {
  try {
    const types = JSON.parse(eventTypesJson) as string[];
    return Array.isArray(types) && types.includes(eventType);
  } catch {
    return false;
  }
}

async function deliverOne(url: string, secret: string, body: string): Promise<{ ok: boolean; status: number; error?: string }> {
  const sig = createHmac('sha256', secret).update(body).digest('hex');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Portal-Signature': `sha256=${sig}`,
      },
      body,
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: t.slice(0, 300) };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, error: msg.slice(0, 300) };
  }
}

/** Queue delivery rows for matching org endpoints. */
export async function enqueueWebhookEvent(
  db: typeof DbType,
  organizationId: number,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<number> {
  const endpoints = await db
    .select()
    .from(schema.webhookEndpoints)
    .where(
      and(
        eq(schema.webhookEndpoints.organizationId, organizationId),
        eq(schema.webhookEndpoints.enabled, true),
      ),
    );
  const body = JSON.stringify({ event: eventType, organizationId, ...payload, at: new Date().toISOString() });
  let queued = 0;
  for (const ep of endpoints) {
    if (!endpointWantsEvent(ep.eventTypes, eventType)) continue;
    await db.insert(schema.webhookDeliveries).values({
      endpointId: ep.id,
      eventType,
      payload: body,
      status: 'pending',
      attempts: 0,
    });
    queued++;
  }
  return queued;
}

/** Process pending webhook deliveries (cron). */
export async function processPendingWebhookDeliveries(db: typeof DbType, limit = 40): Promise<{ processed: number; success: number; failed: number }> {
  const pending = await db
    .select()
    .from(schema.webhookDeliveries)
    .where(eq(schema.webhookDeliveries.status, 'pending'))
    .orderBy(schema.webhookDeliveries.id)
    .limit(limit);

  let success = 0;
  let failed = 0;
  for (const row of pending) {
    const [ep] = await db
      .select()
      .from(schema.webhookEndpoints)
      .where(eq(schema.webhookEndpoints.id, row.endpointId));
    if (!ep || !ep.enabled) {
      await db
        .update(schema.webhookDeliveries)
        .set({ status: 'failed', lastError: 'endpoint_disabled', attempts: row.attempts + 1 })
        .where(eq(schema.webhookDeliveries.id, row.id));
      failed++;
      continue;
    }
    const result = await deliverOne(ep.url, ep.secret, row.payload);
    if (result.ok) {
      await db
        .update(schema.webhookDeliveries)
        .set({
          status: 'success',
          httpStatus: result.status,
          attempts: row.attempts + 1,
          lastError: null,
        })
        .where(eq(schema.webhookDeliveries.id, row.id));
      success++;
    } else {
      const attempts = row.attempts + 1;
      await db
        .update(schema.webhookDeliveries)
        .set({
          status: attempts >= 3 ? 'failed' : 'pending',
          httpStatus: result.status || null,
          attempts,
          lastError: result.error ?? 'delivery_failed',
        })
        .where(eq(schema.webhookDeliveries.id, row.id));
      failed++;
    }
  }
  return { processed: pending.length, success, failed };
}
