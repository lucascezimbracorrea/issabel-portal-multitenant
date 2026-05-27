import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import type { RouteType } from './routing-types.js';

export async function resolveDestinationLabel(
  orgId: number,
  routeType: RouteType,
  destinationId: number | null,
): Promise<string | null> {
  if (!destinationId || routeType === 'none') return null;
  switch (routeType) {
    case 'ura': {
      const [r] = await db.select({ name: schema.uras.name }).from(schema.uras).where(eq(schema.uras.id, destinationId));
      return r?.name ?? null;
    }
    case 'queue': {
      const [r] = await db.select({ name: schema.queues.name }).from(schema.queues).where(eq(schema.queues.id, destinationId));
      return r?.name ?? null;
    }
    case 'extension': {
      const [r] = await db
        .select({ displayName: schema.extensions.displayName, number: schema.extensions.number })
        .from(schema.extensions)
        .where(eq(schema.extensions.id, destinationId));
      return r ? `${r.displayName} (${r.number})` : null;
    }
    case 'call_flow': {
      const [r] = await db.select({ name: schema.callFlows.name }).from(schema.callFlows).where(eq(schema.callFlows.id, destinationId));
      return r?.name ?? null;
    }
    default:
      return null;
  }
}

export async function resolveDestinationLabelForDtmf(
  orgId: number,
  action: string,
  destinationId: number | null | undefined,
): Promise<string | null> {
  if (!destinationId || action === 'none' || action === 'hangup') return null;
  const routeType = action === 'ura' ? 'ura' : action === 'queue' ? 'queue' : action === 'extension' ? 'extension' : 'none';
  if (routeType === 'none') return null;
  return resolveDestinationLabel(orgId, routeType, destinationId);
}
