import { count, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';

export type DiskUsage = {
  usedBytes: number;
  totalBytes: number;
  usedPct: number;
} | null;

export async function readHostDiskUsage(): Promise<DiskUsage> {
  try {
    const { statfs } = await import('node:fs/promises');
    const s = await statfs('/');
    const total = Number(s.blocks) * Number(s.bsize);
    const avail = Number(s.bavail) * Number(s.bsize);
    if (!total || total <= 0) return null;
    const used = total - avail;
    return {
      usedBytes: used,
      totalBytes: total,
      usedPct: Math.round((used / total) * 1000) / 10,
    };
  } catch {
    return null;
  }
}

export type PlatformOverview = {
  totalOrganizations: number;
  activeOrganizations: number;
  totalExtensions: number;
  dialerChannelsUsed: number;
  dialerChannelsMax: number;
  pabxChannelsUsed: number;
  pabxChannelsMax: number;
  disk: DiskUsage;
};

export async function buildPlatformOverview(): Promise<PlatformOverview> {
  const [{ c: totalOrganizations }] = await db.select({ c: count() }).from(schema.organizations);
  const [{ c: activeOrganizations }] = await db
    .select({ c: count() })
    .from(schema.organizations)
    .where(eq(schema.organizations.active, true));
  const [{ c: totalExtensions }] = await db.select({ c: count() }).from(schema.extensions);

  const orgs = await db.select().from(schema.organizations);
  let dialerChannelsMax = 0;
  let pabxChannelsMax = 0;
  for (const o of orgs) {
    const lim = o.channelsLimit ?? 0;
    if (o.orgKind === 'dialer') dialerChannelsMax += lim;
    else pabxChannelsMax += lim;
  }

  const disk = await readHostDiskUsage();

  return {
    totalOrganizations: Number(totalOrganizations),
    activeOrganizations: Number(activeOrganizations),
    totalExtensions: Number(totalExtensions),
    dialerChannelsUsed: 0,
    dialerChannelsMax,
    pabxChannelsUsed: 0,
    pabxChannelsMax,
    disk,
  };
}
