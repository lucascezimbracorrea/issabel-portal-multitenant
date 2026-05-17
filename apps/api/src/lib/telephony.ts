import type { InferSelectModel } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import {
  fetchTelephonyFromCdr,
  globalCdrConfigFromEnv,
  parseCdrConfig,
  type CdrMysqlConfig,
  type TelephonyOverviewCdr,
} from './issabel-cdr.js';

export type TelephonyOverview = {
  organizationId: number;
  calls24h: number;
  inboundPct: number;
  answerRate: number;
  avgDurationSec: number;
  asrPct: number;
  hourly: number[];
  recentCalls: {
    id: string;
    direction: 'inbound' | 'outbound';
    from: string;
    to: string;
    durationSec: number;
    disposition: string;
  }[];
  source: 'demo' | 'cdr';
  /** When source=cdr: 5-min buckets over 24h (call volume). When demo: empty */
  simultaneousBuckets?: number[];
  bucketMinutes?: number;
  onlineCallsEstimate?: number;
};

type OrgRow = InferSelectModel<typeof schema.organizations>;

function telephonyDemoSnapshot(organizationId: number): TelephonyOverview {
  const h = (organizationId * 2654435761) >>> 0;
  const byte = (shift: number) => (h >>> shift) & 0xff;
  const calls24h = 220 + (byte(0) % 180);
  const inboundPct = 42 + (byte(8) % 25);
  const answerRate = 84 + (byte(16) % 12);
  const avgDurationSec = 95 + (byte(24) % 90);
  const asrPct = 96 + (byte(4) % 35) / 10;
  const hourly = Array.from({ length: 24 }, (_, i) => 8 + ((byte(i) + i * 7) % 28));
  const recentCalls = [
    { id: `${organizationId}-1`, direction: 'inbound' as const, from: '+55 11 9****-1201', to: '201', durationSec: 184 + (byte(1) % 40), disposition: 'answered' },
    { id: `${organizationId}-2`, direction: 'outbound' as const, from: '105', to: '+55 21 9****-8832', durationSec: 62 + (byte(2) % 20), disposition: 'answered' },
    { id: `${organizationId}-3`, direction: 'inbound' as const, from: '+351 2** *** 441', to: 'IVR', durationSec: byte(5) % 4, disposition: 'abandoned' },
    { id: `${organizationId}-4`, direction: 'inbound' as const, from: '+55 11 4***-0092', to: 'Fila Vendas', durationSec: 241, disposition: 'answered' },
    { id: `${organizationId}-5`, direction: 'outbound' as const, from: '302', to: '+55 47 9****-2210', durationSec: 315, disposition: 'answered' },
    { id: `${organizationId}-6`, direction: 'inbound' as const, from: '+55 85 3***-7781', to: '201', durationSec: 128, disposition: 'voicemail' },
  ];
  return {
    organizationId,
    calls24h,
    inboundPct,
    answerRate,
    avgDurationSec,
    asrPct,
    hourly,
    recentCalls,
    source: 'demo',
  };
}

function cdrMysqlFromOrg(org: OrgRow): CdrMysqlConfig | null {
  const raw = org.cdrMysql;
  if (raw?.trim()) {
    const parsed = parseCdrConfig(raw);
    if (parsed) return parsed;
  }
  return globalCdrConfigFromEnv();
}

function accountcodeFromOrg(org: OrgRow): string | null {
  if (!org.cdrMysql?.trim()) return null;
  try {
    const j = JSON.parse(org.cdrMysql) as Record<string, unknown>;
    return typeof j.accountcode === 'string' ? j.accountcode : null;
  } catch {
    return null;
  }
}

function cdrToOverview(row: TelephonyOverviewCdr): TelephonyOverview {
  return {
    organizationId: row.organizationId,
    calls24h: row.calls24h,
    inboundPct: row.inboundPct,
    answerRate: row.answerRate,
    avgDurationSec: row.avgDurationSec,
    asrPct: row.asrPct,
    hourly: row.hourly,
    recentCalls: row.recentCalls,
    source: 'cdr',
    simultaneousBuckets: row.simultaneousBuckets,
    bucketMinutes: row.bucketMinutes,
    onlineCallsEstimate: row.onlineCallsEstimate,
  };
}

export async function resolveTelephonyOverview(org: OrgRow | undefined, organizationId: number): Promise<TelephonyOverview> {
  const cfg = org ? cdrMysqlFromOrg(org) : globalCdrConfigFromEnv();
  if (!cfg) return telephonyDemoSnapshot(organizationId);
  try {
    const ac = org ? accountcodeFromOrg(org) : null;
    const data = await fetchTelephonyFromCdr(organizationId, cfg, { accountcode: ac });
    return cdrToOverview(data);
  } catch (e) {
    console.error('[telephony] CDR fetch failed, using demo snapshot:', e);
    return { ...telephonyDemoSnapshot(organizationId), source: 'demo' };
  }
}
