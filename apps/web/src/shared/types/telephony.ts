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
  simultaneousBuckets?: number[];
  bucketMinutes?: number;
  onlineCallsEstimate?: number;
};

export type PlatformOverview = {
  totalOrganizations: number;
  activeOrganizations: number;
  totalExtensions: number;
  dialerChannelsUsed: number;
  dialerChannelsMax: number;
  pabxChannelsUsed: number;
  pabxChannelsMax: number;
  disk: { usedBytes: number; totalBytes: number; usedPct: number } | null;
};

export type CdrHistoryRow = {
  calldate: string;
  src: string;
  dst: string;
  duration: number;
  billsec: number;
  disposition: string;
  uniqueid: string;
  dcontext: string | null;
  accountcode: string | null;
};
