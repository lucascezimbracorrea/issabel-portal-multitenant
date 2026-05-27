import net from 'node:net';

export type QueueAmiMetrics = {
  callsWaiting: number;
  answeredToday: number;
  abandonedToday: number;
  avgWaitSec: number;
  avgTalkSec: number;
  serviceLevelPct: number;
  demo: false;
  source: 'ami' | 'queue_log';
};

export type AmiConfig = {
  host: string;
  port: number;
  user: string;
  secret: string;
};

export function parseAmiFromEnv(): AmiConfig | null {
  const host = process.env.AMI_HOST?.trim();
  const user = process.env.AMI_USER?.trim();
  const secret = process.env.AMI_SECRET?.trim();
  if (!host || !user || !secret) return null;
  return {
    host,
    port: Number(process.env.AMI_PORT ?? 5038),
    user,
    secret,
  };
}

export function parseAmiFromPbxApiJson(raw: string | null | undefined): AmiConfig | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const host = typeof j.amiHost === 'string' ? j.amiHost : null;
    const user = typeof j.amiUser === 'string' ? j.amiUser : null;
    const secret = typeof j.amiSecret === 'string' ? j.amiSecret : null;
    if (!host || !user || !secret) return null;
    return {
      host,
      port: typeof j.amiPort === 'number' ? j.amiPort : Number(j.amiPort ?? 5038),
      user,
      secret,
    };
  } catch {
    return null;
  }
}

function parseAmiBlocks(raw: string): Array<Record<string, string>> {
  const blocks = raw.split(/\r?\n\r?\n/).filter((b) => b.trim());
  return blocks.map((block) => {
    const rec: Record<string, string> = {};
    for (const line of block.split(/\r?\n/)) {
      const idx = line.indexOf(':');
      if (idx > 0) rec[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return rec;
  });
}

/** Low-level AMI: login, single action, collect response until blank line after Complete event. */
export async function amiRequest(
  cfg: AmiConfig,
  action: string,
  fields: Record<string, string> = {},
  timeoutMs = 10_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(cfg.port, cfg.host);
    let buf = '';
    let loggedIn = false;
    let actionSent = false;
    let settled = false;

    const finish = (err?: Error, data?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (err) reject(err);
      else resolve(data ?? buf);
    };

    const timer = setTimeout(() => finish(new Error('ami_timeout')), timeoutMs);

    const sendAction = (name: string, params: Record<string, string>) => {
      const lines = [`Action: ${name}`, `ActionID: portal-${Date.now()}`];
      for (const [k, v] of Object.entries(params)) lines.push(`${k}: ${v}`);
      socket.write(`${lines.join('\r\n')}\r\n\r\n`);
    };

    socket.on('error', (e) => finish(e instanceof Error ? e : new Error(String(e))));
    socket.on('data', (chunk) => {
      buf += chunk.toString();
      if (!loggedIn && buf.includes('Authentication accepted')) {
        loggedIn = true;
        sendAction(action, fields);
        actionSent = true;
        return;
      }
      if (!loggedIn && buf.includes('Authentication failed')) {
        finish(new Error('ami_auth_failed'));
        return;
      }
      if (actionSent) {
        const complete =
          buf.includes('Response: Error') ||
          buf.includes('QueueSummaryComplete') ||
          buf.includes('OriginateResponse') ||
          (buf.includes('Response: Success') && action === 'Login') ||
          (action !== 'QueueSummary' &&
            action !== 'Originate' &&
            buf.includes('Response: Success') &&
            !buf.includes('Message: Authentication accepted'));
        if (action === 'Originate' && buf.includes('Response:')) {
          finish(undefined, buf);
        } else if (action === 'QueueSummary' && buf.includes('QueueSummaryComplete')) {
          finish(undefined, buf);
        } else if (action === 'MailboxCount' && buf.match(/Event: MailboxCount\r?\n/i)) {
          finish(undefined, buf);
        } else if (complete && action !== 'QueueSummary' && action !== 'Originate') {
          finish(undefined, buf);
        }
      }
    });

    socket.on('connect', () => {
      socket.write(
        `Action: Login\r\nUsername: ${cfg.user}\r\nSecret: ${cfg.secret}\r\nEvents: off\r\n\r\n`,
      );
    });
  });
}

export async function fetchQueueAmiMetrics(
  cfg: AmiConfig,
  queueName: string,
): Promise<QueueAmiMetrics | null> {
  try {
    const raw = await amiRequest(cfg, 'QueueSummary', { Queue: queueName });
    const blocks = parseAmiBlocks(raw);
    let callsWaiting = 0;
    let holdtime = 0;
    for (const b of blocks) {
      if (b.Event === 'QueueSummary' && b.Queue === queueName) {
        callsWaiting = Number(b.Callers ?? b.Hold ?? 0) || 0;
        holdtime = Number(b.Holdtime ?? 0) || 0;
      }
    }
    return {
      callsWaiting,
      answeredToday: 0,
      abandonedToday: 0,
      avgWaitSec: holdtime,
      avgTalkSec: 0,
      serviceLevelPct: 0,
      demo: false,
      source: 'ami',
    };
  } catch {
    return null;
  }
}

export type OriginateResult = { ok: true; detail: string } | { ok: false; detail: string };

/** Click-to-call: ring agent extension then bridge to destination. */
export async function amiOriginateCall(
  cfg: AmiConfig,
  params: {
    fromExtension: string;
    toNumber: string;
    context?: string;
    callerId?: string;
  },
): Promise<OriginateResult> {
  const channel = `PJSIP/${params.fromExtension}`;
  const ctx = params.context ?? 'from-internal';
  try {
    const raw = await amiRequest(cfg, 'Originate', {
      Channel: channel,
      Context: ctx,
      Exten: params.toNumber.replace(/\D/g, ''),
      Priority: '1',
      CallerID: params.callerId ?? params.fromExtension,
      Async: 'true',
      Timeout: '30000',
    });
    if (raw.includes('Response: Success') || raw.includes('Originate successfully')) {
      return { ok: true, detail: 'originate_sent' };
    }
    const err = raw.match(/Message: (.+)/)?.[1] ?? 'originate_failed';
    return { ok: false, detail: err.slice(0, 200) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg.slice(0, 200) };
  }
}

export async function amiMailboxCount(
  cfg: AmiConfig,
  mailbox: string,
): Promise<{ newMessages: number; oldMessages: number } | null> {
  try {
    const raw = await amiRequest(cfg, 'MailboxCount', { Mailbox: mailbox });
    const blocks = parseAmiBlocks(raw);
    for (const b of blocks) {
      if (b.Event === 'MailboxCount' || b.Mailbox === mailbox) {
        return {
          newMessages: Number(b.NewMessages ?? 0) || 0,
          oldMessages: Number(b.OldMessages ?? 0) || 0,
        };
      }
    }
    const m = raw.match(/NewMessages:\s*(\d+)/i);
    const o = raw.match(/OldMessages:\s*(\d+)/i);
    if (m) return { newMessages: Number(m[1]), oldMessages: Number(o?.[1] ?? 0) };
    return null;
  } catch {
    return null;
  }
}
